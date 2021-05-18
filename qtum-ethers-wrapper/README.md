# Notes

- To Fix

Getting data necessary to build a contract address (python: serialize uint256(txid) + uInt32LE(vout)), sha256, hash160

bitcoinjs-lib is not compiling the evm_create/evm_call scripts correctly, although the raw signed TX can be submitted to the network without any issues.

Fee estimation before script is serialized(?)

Parse signed transaction

Finish writing unit tests

Refactor

Set global variables