def runCommand(String unixCommand, String windowsCommand) {
  if (isUnix()) {
    sh unixCommand
  } else {
    bat windowsCommand
  }
}

// Reject any operator-supplied URL parameter that is not a plain http(s) URL.
// This is a strict allowlist that cannot contain shell metacharacters, so the
// value is safe to place in the process environment (see withEnv usage below).
def assertSafeUrl(String name, String value) {
  if (!(value ==~ '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~/-]*)?$')) {
    error("Refusing build: parameter ${name} is not a valid http(s) URL")
  }
}

pipeline {
  agent any

  parameters {
    string(name: 'NEXT_PUBLIC_API_BASE_URL', defaultValue: 'http://localhost:8080', description: 'Backend base URL baked into the Next.js build')
    string(name: 'NEXT_PUBLIC_APP_URL', defaultValue: 'http://localhost:3000', description: 'Frontend public URL baked into the Next.js build')
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
          assertSafeUrl('NEXT_PUBLIC_API_BASE_URL', params.NEXT_PUBLIC_API_BASE_URL)
          assertSafeUrl('NEXT_PUBLIC_APP_URL', params.NEXT_PUBLIC_APP_URL)
          withEnv([
            "NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL}",
            "NEXT_PUBLIC_APP_URL=${params.NEXT_PUBLIC_APP_URL}"
          ]) {
            runCommand('npm run build', 'npm run build')
          }
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        script {
          assertSafeUrl('NEXT_PUBLIC_API_BASE_URL', params.NEXT_PUBLIC_API_BASE_URL)
          assertSafeUrl('NEXT_PUBLIC_APP_URL', params.NEXT_PUBLIC_APP_URL)
          withEnv([
            "NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL}",
            "NEXT_PUBLIC_APP_URL=${params.NEXT_PUBLIC_APP_URL}"
          ]) {
            runCommand(
              "docker build --build-arg NEXT_PUBLIC_API_BASE_URL --build-arg NEXT_PUBLIC_APP_URL -t ${env.IMAGE_NAME}:${env.IMAGE_TAG} -t ${env.IMAGE_NAME}:latest .",
              "docker build --build-arg NEXT_PUBLIC_API_BASE_URL --build-arg NEXT_PUBLIC_APP_URL -t ${env.IMAGE_NAME}:${env.IMAGE_TAG} -t ${env.IMAGE_NAME}:latest ."
            )
          }
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
          def frontendPort = params.FRONTEND_PORT
          if (!(frontendPort ==~ /^[0-9]{1,5}$/) || frontendPort.toInteger() < 1 || frontendPort.toInteger() > 65535) {
            error('FRONTEND_PORT must be an integer between 1 and 65535')
          }
          withEnv([
            "NEXT_PUBLIC_API_BASE_URL=${params.NEXT_PUBLIC_API_BASE_URL}",
            "NEXT_PUBLIC_APP_URL=${params.NEXT_PUBLIC_APP_URL}"
          ]) {
            runCommand(
              "docker rm -f crypto_portfolio_frontend || true && docker run -d --name crypto_portfolio_frontend -p ${frontendPort}:3000 -e NEXT_PUBLIC_API_BASE_URL -e NEXT_PUBLIC_APP_URL ${env.IMAGE_NAME}:${env.IMAGE_TAG}",
              "docker rm -f crypto_portfolio_frontend 2>NUL\r\ndocker run -d --name crypto_portfolio_frontend -p ${frontendPort}:3000 -e NEXT_PUBLIC_API_BASE_URL -e NEXT_PUBLIC_APP_URL ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
            )
          }
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
