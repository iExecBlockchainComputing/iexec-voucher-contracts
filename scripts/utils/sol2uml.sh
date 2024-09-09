#!/bin/bash
# Note: Please re-run this script from time to time. UML generation is not 
# added to the pre-commit hook to avoid booming code changes on every commit.

mkdir -p build/
# Flatten contract to avoid `Maximum call stack size exceeded` issue:
# https://github.com/naddison36/sol2uml/issues/183
npx hardhat flatten > build/flatten.sol 2> /dev/null # Flatten contracts & hide logs

# Some options (depth, hide libraries, hideinterfaces, ..) are not working 
# properly after sol2uml@2.5.19
npx sol2uml class build/flatten.sol \
    --hideFilename \
    --baseContractNames VoucherHub \
    --outputFileName  docs/class-diagram.svg  \
    --hideLibraries \
    --hideInterfaces # Hide libraries and interfaces to get a decent output diagram

rm build/flatten.sol
