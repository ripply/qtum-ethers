# Notes

- To Fix

Fee estimation before script is serialized(?)

Finish writing unit tests

Refactor

Set global variables

Creating an abstract class for changing the Wallet address property didn't work as intended, so I created a clone of the Wallet that would be extended while changing the way the address is defined in 
the constuctor.

Issue with writeUint32LE after writing vouts to buffercursor on a bigger smart contract deployment