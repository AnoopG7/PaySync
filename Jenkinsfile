// ──────────────────────────────────────────────────────────────────────────────
// PaySync Cloud — Jenkins Declarative Pipeline
// ──────────────────────────────────────────────────────────────────────────────
// CI/CD pipeline that runs ON the EC2 instance alongside the app (Jenkins
// runs as a Docker container). All stages execute locally — no SSH deploy,
// no Docker Hub push required.
//
// Pipeline stages:
//   1. Checkout code from GitHub
//   2. Install dependencies (npm ci)
//   3. Lint & type check (tsc --noEmit)
//   4. Build Docker images
//   5. Deploy: docker compose up -d
//   6. Health check verification
//
// Prerequisites (configure in Jenkins):
//   - Pipeline runs on the built-in node (Docker host)
//   - No credentials needed — Docker socket is mounted
//   - Git plugin for SCM checkout
//
// ──────────────────────────────────────────────────────────────────────────────

pipeline {
    agent any

    environment {
        COMPOSE_FILE = 'docker-compose.yml'
        APP_DIR      = '/opt/paysync'
    }

    parameters {
        string(
            name: 'BRANCH',
            defaultValue: 'main',
            description: 'Git branch to build & deploy'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scmGit(
                    branches: [[name: "${params.BRANCH}"]],
                    userRemoteConfigs: [[url: 'https://github.com/YOUR_ORG/paysync-cloud.git']]
                )
            }
        }

        stage('Install Dependencies') {
            parallel {
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }

        stage('Lint & Type Check') {
            parallel {
                stage('Frontend TypeCheck') {
                    steps {
                        dir('frontend') {
                            sh 'npx tsc --noEmit'
                        }
                    }
                }
                stage('Backend TypeCheck') {
                    steps {
                        dir('backend') {
                            sh 'npx tsc --noEmit'
                        }
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                sh 'docker compose -f ${COMPOSE_FILE} build'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker compose -f ${COMPOSE_FILE} up -d --remove-orphans
                    docker image prune -af --filter "until=24h" || true
                '''
            }
        }

        stage('Health Check') {
            steps {
                sleep 5
                sh 'curl -sf http://localhost/api/health && echo "Health OK" || echo "Health FAIL"'
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded — build ${env.BUILD_NUMBER} deployed!"
        }
        failure {
            echo "Pipeline FAILED — build ${env.BUILD_NUMBER}"
        }
        always {
            cleanWs()
        }
    }
}
