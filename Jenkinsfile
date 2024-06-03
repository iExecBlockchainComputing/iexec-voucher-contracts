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
            sh 'npm run coverage'
        }
    }

    // /**
    //     * Usage example:
    //     * docker run --rm --entrypoint /bin/bash -v $(pwd):/share \
    //     *  -e SOLC='<solc-version>' trailofbits/eth-security-toolbox -c \
    //     *  'cd /share && solc-select install $SOLC && \
    //     *  slither --solc-solcs-select $SOLC <contract-path>'
    //     */
    // stage('Slither') {
    //     agent {
    //         docker {
    //             reuseNode true
    //             // At this time, trailofbits/eth-security-toolbox packages
    //             // an old slither version, hence we use another Docker image
    //             // (which is less user-friendly. Example: node not included)
    //             // See https://github.com/crytic/slither/issues/2207#issuecomment-1787222979
    //             // As discribed in the issue, version 0.8.3 is not compatible
    //             image 'ghcr.io/crytic/slither:0.10.0'
    //             args "-e SOLC='0.8.21' --entrypoint="
    //         }
    //     }
    //     steps {
    //         script {
    //             try {
    //                 sh 'solc-select install $SOLC && slither --solc-solcs-select $SOLC contracts/VoucherHub.sol'
    //             } catch (err) {
    //                 sh "echo ${STAGE_NAME} stage is unstable"
    //             }
    //         }
    //     }
    // }
}
