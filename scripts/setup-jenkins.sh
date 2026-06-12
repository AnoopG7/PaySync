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

# Create systemd override: limit memory (setup wizard handled by init.groovy.d)
mkdir -p /etc/systemd/system/jenkins.service.d
cat > /etc/systemd/system/jenkins.service.d/override.conf << 'OVERRIDE'
[Service]
Environment="JAVA_OPTS=-Xmx256m -Xms128m"
OVERRIDE

# Create init.groovy.d script to set up admin user + URL
mkdir -p /var/lib/jenkins/init.groovy.d
cat > /var/lib/jenkins/init.groovy.d/setup.groovy << 'GROOVY'
import jenkins.model.*
import hudson.security.*
import jenkins.security.s2m.AdminWhitelistRule

def instance = Jenkins.getInstanceOrNull()
if (instance == null) return

// Force admin user with known password (delete + recreate)
def hudsonRealm = new HudsonPrivateSecurityRealm(false)
try {
    hudsonRealm.deleteUser("admin")
    println "Deleted existing admin user"
} catch (e) {
    println "No existing admin user to delete"
}
hudsonRealm.createAccount("admin", "admin123")
println "Created admin user: admin / admin123"
instance.setSecurityRealm(hudsonRealm)
instance.setAuthorizationStrategy(new FullControlOnceLoggedInAuthorizationStrategy())
instance.save()

// Disable CLI agent whitelist
instance.getInjector().getInstance(AdminWhitelistRule.class).setMasterKillSwitch(false)

// Set Jenkins URL
def ip = new URL("http://checkip.amazonaws.com").text.trim()
def url = "http://${ip}:8080/"
def loc = JenkinsLocationConfiguration.get()
loc.setUrl(url)
loc.setAdminAddress("admin@paysync.cloud")
loc.save()
println "Jenkins URL set to: $url"
GROOVY

systemctl daemon-reload
echo "[✓] Config written"

# ── 4. Start / Restart Jenkins ──
echo "[4/6] Starting Jenkins..."
systemctl enable jenkins 2>/dev/null || true
# Use restart — if Jenkins is already running (e.g., from apt install auto-start),
# start is a no-op and won't pick up the new systemd override or docker group.
systemctl restart jenkins || true

# First wait: Jenkins stopping + starting up fresh
echo "[*] Waiting for Jenkins to start..."
for i in {1..60}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$JENKINS_URL" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then break; fi
    sleep 3
done
echo "[✓] Jenkins ready (HTTP $STATUS)"
echo "[*] Waiting for init.groovy.d scripts to execute..."
sleep 15

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
lines.append('                sh "docker compose -p paysync up -d --force-recreate --remove-orphans backend frontend && docker image prune -af --filter until=24h || true"')
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
ET.SubElement(definition, "sandbox").text = "true"
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

# Jenkins 2.555+ has strict CSRF — CLI jar auth is broken.
# Use REST API with crumb for all operations.

# Get CSRF crumb + session cookie
JENKINS_COOKIE=$(mktemp)
CRUMB_JSON=$(curl -s -u "admin:admin123" -c "$JENKINS_COOKIE" "$JENKINS_URL/crumbIssuer/api/json")
CRUMB=$(echo "$CRUMB_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['crumb'])" 2>/dev/null || echo "")
CRUMB_HEADER=$(echo "$CRUMB_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['crumbRequestField'])" 2>/dev/null || echo "Jenkins-Crumb")

# Install plugins via Script Console (CLI jar broken in Jenkins 2.555+ due to CSRF)
echo "[*] Installing plugins..."
PLUGINS="git workflow-aggregator blueocean"
for plugin in $PLUGINS; do
    echo "  Installing $plugin..."
    RESULT=$(curl -s -X POST -u "admin:admin123" -b "$JENKINS_COOKIE" \
      -H "${CRUMB_HEADER}: ${CRUMB}" \
      "$JENKINS_URL/scriptText" \
      --data-urlencode "script=Jenkins.instance.pluginManager.install(Arrays.asList(\"$plugin\"), false).each{ println it.get() }" 2>/dev/null)
    echo "    $RESULT"
done

# Restart to load plugins
echo "[*] Restarting to load plugins..."
sudo systemctl restart jenkins

for i in $(seq 1 90); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then break; fi
    sleep 3
done
echo "  Jenkins ready (HTTP $STATUS)"

# Re-get crumb after restart
JENKINS_COOKIE=$(mktemp)
CRUMB_JSON=$(curl -s -u "admin:admin123" -c "$JENKINS_COOKIE" "$JENKINS_URL/crumbIssuer/api/json")
CRUMB=$(echo "$CRUMB_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['crumb'])" 2>/dev/null || echo "")
CRUMB_HEADER=$(echo "$CRUMB_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['crumbRequestField'])" 2>/dev/null || echo "Jenkins-Crumb")

# Trigger build via REST API (only if .env has real RDS host)
if grep -q '__REPLACE_ME__' /opt/paysync/.env 2>/dev/null; then
    echo "[!] .env still has placeholder RDS_HOST — skipping auto-build."
    echo "[!] After SSH, fix RDS host, then trigger build:"
    echo "    curl -X POST 'http://$PUBLIC_IP:8080/job/paysync-pipeline/buildWithParameters?BRANCH=main' -u admin:admin123"
else
    echo "[*] Triggering build..."
    curl -s -o /dev/null -X POST \
      -u "admin:admin123" -b "$JENKINS_COOKIE" \
      -H "${CRUMB_HEADER}: ${CRUMB}" \
      "$JENKINS_URL/job/paysync-pipeline/buildWithParameters?BRANCH=main"
    echo "  Build triggered!"
fi

rm -f "$JENKINS_COOKIE"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Native Jenkins Setup Complete!"
echo "  URL:        http://$PUBLIC_IP:8080"
echo "  Login:      admin / admin123"
echo "  Job:        http://$PUBLIC_IP:8080/job/paysync-pipeline/"
echo "  Workspace:  /var/lib/jenkins/workspace/paysync-pipeline/"
echo "  Log:        journalctl -u jenkins.service"
echo "═══════════════════════════════════════════════════════════════"
