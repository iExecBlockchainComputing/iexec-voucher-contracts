// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

node {
    stage('Clone') {
        cleanWs()
        checkoutInfo = checkout(scm)
        echo "git checkout: ${checkoutInfo}"
    }
    docker.image('node:20-alpine').inside {
        stage('Init') {
            sh 'npm ci'
        }
        stage('Test') {
            sh 'npm run test-ci'
        }
    }
}
