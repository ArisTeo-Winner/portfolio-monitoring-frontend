def runCommand(String unixCommand, String windowsCommand) {
  if (isUnix()) {
    sh unixCommand
  } else {
    bat windowsCommand
  }
}

pipeline {
  agent any

  parameters {
    string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: 'http://localhost:8080', description: 'Backend base URL baked into the Next.js build')
    string(name: 'FRONTEND_PORT', defaultValue: '3000', description: 'Host port used when DEPLOY_CONTAINER is enabled')
    booleanParam(name: 'DEPLOY_CONTAINER', defaultValue: false, description: 'Run the built image as crypto_portfolio_frontend after a successful build')
  }

  environment {
    IMAGE_NAME = 'crypto-portfolio-monitoring-frontend'
    IMAGE_TAG = "${env.BUILD_NUMBER}"
    NEXT_TELEMETRY_DISABLED = '1'
  }

  stages {
    stage('Install') {
      steps {
        script {
          runCommand('npm ci', 'npm ci')
        }
      }
    }

    stage('Test') {
      steps {
        script {
          runCommand('npm test', 'npm test')
        }
      }
    }

    stage('Build Next.js') {
      steps {
        script {
          runCommand(
            "NEXT_PUBLIC_API_BASE_URL='${params.NEXT_PUBLIC_API_BASE_URL}' npm run build",
            "set NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL}&& npm run build"
          )
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          runCommand(
            "docker build --build-arg NEXT_PUBLIC_API_BASE_URL='${params.NEXT_PUBLIC_API_BASE_URL}' -t ${env.IMAGE_NAME}:${env.IMAGE_TAG} -t ${env.IMAGE_NAME}:latest .",
            "docker build --build-arg NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL} -t ${env.IMAGE_NAME}:${env.IMAGE_TAG} -t ${env.IMAGE_NAME}:latest ."
          )
        }
      }
    }

    stage('Smoke Test Image') {
      steps {
        script {
          runCommand(
            "docker run --rm ${env.IMAGE_NAME}:${env.IMAGE_TAG} node -e \"require('fs').accessSync('server.js')\"",
            "docker run --rm ${env.IMAGE_NAME}:${env.IMAGE_TAG} node -e \"require('fs').accessSync('server.js')\""
          )
        }
      }
    }

    stage('Deploy Container') {
      when {
        expression { return params.DEPLOY_CONTAINER }
      }
      steps {
        script {
          runCommand(
            "docker rm -f crypto_portfolio_frontend || true && docker run -d --name crypto_portfolio_frontend -p ${params.FRONTEND_PORT}:3000 -e NEXT_PUBLIC_API_BASE_URL='${params.NEXT_PUBLIC_API_BASE_URL}' ${env.IMAGE_NAME}:${env.IMAGE_TAG}",
            "docker rm -f crypto_portfolio_frontend 2>NUL\r\ndocker run -d --name crypto_portfolio_frontend -p ${params.FRONTEND_PORT}:3000 -e NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL} ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
          )
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '.next/**, package-lock.json', allowEmptyArchive: true
    }
  }
}
