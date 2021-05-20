# Notes

- Issues

At the point of grabbing UTXO's from janus, the estimated TX size is unknown

WEI -> Satoshis

Janus issue with estimateGas

Janus requires gasLimit and gasPrice for getters via eth_call

Janus doesn't return a transaction receipt for p2pkh tx's

This extension works with p2pkh scripts only

Creating an abstract class for changing the Wallet address property didn't work as intended, so I created a clone of the Wallet that would be extended while changing the way the address is defined in 
the constuctor.

