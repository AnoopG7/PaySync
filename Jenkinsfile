pipeline {
    agent any

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
                    userRemoteConfigs: [[url: 'https://github.com/AnoopG7/PaySync.git']]
                )
            }
        }

        stage('Prepare Environment') {
            steps {
                sh 'cp /opt/paysync/.env .env || echo "No .env to copy"'
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
                sh 'docker compose -p paysync build'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker compose -p paysync up -d --force-recreate --remove-orphans backend frontend
                    docker image prune -af --filter "until=24h" || true
                '''
            }
        }

        stage('Health Check') {
            steps {
                sleep 15
                sh 'curl -sf http://localhost:3001/api/health && echo "Health OK" || echo "Health FAIL"'
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
