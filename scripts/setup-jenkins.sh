#!/usr/bin/env bash
set -euo pipefail

JENKINS_URL="http://localhost:8080"
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "localhost")

# Install Node.js 22.x (needed for pipeline npm/tsc stages)
echo "[*] Ensuring Node.js 22.x is installed..."
if ! command -v node &>/dev/null || [[ "$(node --version)" != v22* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
    echo "[✓] Node.js: $(node --version)  npm: $(npm --version)"
else
    echo "[✓] Node.js already installed: $(node --version)"
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  PaySync — Native Jenkins Setup (Ubuntu 24.04)"
echo "  Docs: https://www.jenkins.io/doc/book/installing/linux/"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. Install Java 21 ──
echo "[1/6] Installing Java 21 (OpenJDK JRE)..."
apt-get install -y -qq fontconfig openjdk-21-jre
echo "[✓] Java: $(java -version 2>&1 | head -1)"

# ── 2. Install Jenkins (LTS) ──
echo "[2/6] Installing Jenkins from apt repo..."
wget -q -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  | tee /etc/apt/sources.list.d/jenkins.list > /dev/null
apt-get update -qq
apt-get install -y -qq jenkins
echo "[✓] Jenkins $(dpkg -s jenkins | grep Version | cut -d' ' -f2) installed"

# ── 3. Configure Jenkins ──
echo "[3/6] Configuring Jenkins..."

# Add jenkins user to docker group
usermod -aG docker jenkins
echo "[✓] jenkins user added to docker group"

# Create systemd override: skip setup wizard + limit memory
mkdir -p /etc/systemd/system/jenkins.service.d
cat > /etc/systemd/system/jenkins.service.d/override.conf << 'OVERRIDE'
[Service]
Environment="JAVA_OPTS=-Djenkins.install.runSetupWizard=false -Xmx256m -Xms128m"
OVERRIDE

# Create init.groovy.d script to set up admin user + CSRF off + URL
mkdir -p /var/lib/jenkins/init.groovy.d
cat > /var/lib/jenkins/init.groovy.d/setup.groovy << 'GROOVY'
import jenkins.model.*
import hudson.security.*
import jenkins.security.s2m.AdminWhitelistRule

def instance = Jenkins.getInstanceOrNull()
if (instance == null) return

if (instance.getSecurity() == null) {
    println "Setting up security..."
    def hudsonRealm = new HudsonPrivateSecurityRealm(false)
    hudsonRealm.createAccount("admin", "admin123")
    instance.setSecurityRealm(hudsonRealm)
    def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
    instance.setAuthorizationStrategy(strategy)
    instance.save()
    instance.getInjector().getInstance(AdminWhitelistRule.class).setMasterKillSwitch(false)
    println "Security configured: admin/admin123"
}

if (!instance.isQuietingDown()) {
    println "Setting Jenkins URL..."
    def url = "http://${System.getenv('PUBLIC_IP') ?: 'localhost'}:8080/"
    def loc = JenkinsLocationConfiguration.get()
    loc.setUrl(url)
    loc.setAdminAddress("admin@paysync.cloud")
    loc.save()
    println "URL set to: $url"
}
GROOVY

# Export PUBLIC_IP for groovy script
export PUBLIC_IP

systemctl daemon-reload
echo "[✓] Config written"

# ── 4. Start Jenkins ──
echo "[4/6] Starting Jenkins..."
systemctl enable jenkins 2>/dev/null || true
systemctl start jenkins || true

for i in {1..60}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$JENKINS_URL" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then break; fi
    sleep 3
done
echo "[✓] Jenkins ready (HTTP $STATUS)"

PASS=$(cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null || echo "")
echo "[✓] Initial admin password: $PASS"

# ── 5. Create Pipeline job ──
echo "[5/6] Creating Pipeline job..."

# Generate job config XML
python3 /opt/paysync/scripts/gen-pipeline-config.py > /tmp/pipeline-config.xml 2>/dev/null || python3 << 'PYEOF' > /tmp/pipeline-config.xml
import xml.etree.ElementTree as ET

lines = []
lines.append('pipeline {')
lines.append('    agent any')
lines.append('    parameters {')
lines.append('        string(name: "BRANCH", defaultValue: "main", description: "Git branch to build & deploy")')
lines.append('    }')
lines.append('    stages {')
lines.append('        stage("Checkout") {')
lines.append('            steps {')
lines.append('                checkout scmGit(')
lines.append('                    branches: [[name: "${params.BRANCH}"]],')
lines.append('                    userRemoteConfigs: [[url: "https://github.com/AnoopG7/PaySync.git"]])')
lines.append('            }')
lines.append('        }')
lines.append('        stage("Prepare Environment") {')
lines.append('            steps {')
lines.append("                sh \"cp /opt/paysync/.env .env || echo 'No .env to copy'\"")
lines.append('            }')
lines.append('        }')
lines.append('        stage("Install Dependencies") {')
lines.append('            parallel {')
lines.append('                stage("Frontend") { steps { dir("frontend") { sh "npm ci" } } }')
lines.append('                stage("Backend") { steps { dir("backend") { sh "npm ci" } } }')
lines.append('            }')
lines.append('        }')
lines.append('        stage("Lint & Type Check") {')
lines.append('            parallel {')
lines.append('                stage("Frontend TypeCheck") { steps { dir("frontend") { sh "npx tsc --noEmit" } } }')
lines.append('                stage("Backend TypeCheck") { steps { dir("backend") { sh "npx tsc --noEmit" } } }')
lines.append('            }')
lines.append('        }')
lines.append('        stage("Build Docker Images") {')
lines.append('            steps { sh "docker compose -p paysync build" }')
lines.append('        }')
lines.append('        stage("Deploy") {')
lines.append('            steps {')
lines.append('                sh "docker compose -p paysync up -d --remove-orphans backend frontend && docker image prune -af --filter until=24h || true"')
lines.append('            }')
lines.append('        }')
lines.append('        stage("Health Check") {')
lines.append('            steps {')
lines.append('                sleep 5')
lines.append('                sh "curl -sf http://localhost:3001/api/health && echo Health OK || echo Health FAIL"')
lines.append('            }')
lines.append('        }')
lines.append('    }')
lines.append('    post {')
lines.append('        success { echo "Pipeline succeeded - build ${env.BUILD_NUMBER} deployed!" }')
lines.append('        failure { echo "Pipeline FAILED - build ${env.BUILD_NUMBER}" }')
lines.append('        always { cleanWs() }')
lines.append('    }')
lines.append('}')

script = '\n'.join(lines)

root = ET.Element("flow-definition")
root.set("plugin", "workflow-job@1571.1580.v18e46842c125")
ET.SubElement(root, "actions")
ET.SubElement(root, "description").text = "PaySync CI/CD pipeline"
ET.SubElement(root, "keepDependencies").text = "false"

props = ET.SubElement(root, "properties")
paramDefProp = ET.SubElement(props, "hudson.model.ParametersDefinitionProperty")
paramDefs = ET.SubElement(paramDefProp, "parameterDefinitions")
sp = ET.SubElement(paramDefs, "hudson.model.StringParameterDefinition")
ET.SubElement(sp, "name").text = "BRANCH"
ET.SubElement(sp, "description").text = "Git branch to build & deploy"
ET.SubElement(sp, "defaultValue").text = "main"
ET.SubElement(sp, "trim").text = "false"

definition = ET.SubElement(root, "definition")
definition.set("class", "org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition")
definition.set("plugin", "workflow-cps@4331.v9d06ed4658ff")
script_el = ET.SubElement(definition, "script")
script_el.text = script
ET.SubElement(definition, "sandbox").text = "false"
ET.SubElement(root, "disabled").text = "false"

xml_str = ET.tostring(root, encoding="unicode", xml_declaration=False)
xml_str = '<?xml version="1.1" encoding="UTF-8"?>\n' + xml_str
print(xml_str)
PYEOF

mkdir -p /var/lib/jenkins/jobs/paysync-pipeline
cp /tmp/pipeline-config.xml /var/lib/jenkins/jobs/paysync-pipeline/config.xml
chown -R jenkins:jenkins /var/lib/jenkins/jobs/paysync-pipeline
echo "[✓] Pipeline job config written"

# ── 6. Install plugins + trigger ──
echo "[6/6] Installing plugins & triggering build..."

# Install CLI jar
curl -s -o /tmp/jenkins-cli.jar "$JENKINS_URL/jnlpJars/jenkins-cli.jar"

# Install plugins
java -jar /tmp/jenkins-cli.jar -s "$JENKINS_URL" -auth "admin:admin123" \
  install-plugin git workflow-aggregator blueocean 2>/dev/null || true

# Reload job config
java -jar /tmp/jenkins-cli.jar -s "$JENKINS_URL" -auth "admin:admin123" \
  reload-configuration 2>/dev/null || true

sleep 3

# Only trigger build if .env has a real RDS host (not placeholder)
if grep -q '__REPLACE_ME__' /opt/paysync/.env 2>/dev/null; then
    echo "[!] .env still has placeholder RDS_HOST — skipping auto-build."
    echo "[!] After SSH, fix RDS host, then run:"
    echo "    java -jar /tmp/jenkins-cli.jar -s $JENKINS_URL -auth 'admin:admin123' \\"
    echo "      build paysync-pipeline -p BRANCH=main"
else
    java -jar /tmp/jenkins-cli.jar -s "$JENKINS_URL" -auth "admin:admin123" \
      build paysync-pipeline -p BRANCH=main 2>/dev/null || true
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Native Jenkins Setup Complete!"
echo "  URL:        http://$PUBLIC_IP:8080"
echo "  Login:      admin / admin123"
echo "  Job:        http://$PUBLIC_IP:8080/job/paysync-pipeline/"
echo "  Workspace:  /var/lib/jenkins/workspace/paysync-pipeline/"
echo "  Log:        journalctl -u jenkins.service"
echo "═══════════════════════════════════════════════════════════════"
