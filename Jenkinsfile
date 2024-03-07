node {
    stage('Clone') {
        checkoutInfo = checkout(scm)
        echo "git checkout: ${checkoutInfo}"
    }
    docker.image('node:20-alpine').inside {
        stage('Init') {
            sh 'npm ci'
        }
        stage('Test') {
            sh 'npx hardhat test'
        }
    }
}