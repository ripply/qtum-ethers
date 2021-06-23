# Qtum Ethers
A module for using Qtum through an Ethers compliant library to make it simpler to use Qtum


# Installation

Open a console and run 

```npm install qtum-ethers```

# Example

```js
const {QtumProvider, QtumWallet, QtumContractFactory} = require("qtum-ethers")
// point Qtum Provider at Janus node
const provider = new QtumProvider("http://localhost:23889");
// create a wallet
const privkey = "99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e"
const signer = new QtumWallet(
    privkey,
    provider
)
// ABI and Bytecode
const ABI = /*[insert ABI here]*/]
const BYTECODE = /*"Bytecode goes here"*/
const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);

// simpleStore deployment example, returns address
async function deployToken() {
	const deployment = await simpleStore.deploy({
    	gasLimit: "0x2dc6c0", gasPrice: "0x28"
	});
	await deployment.deployed();
	return deployment.address
}
// connect to QRC20 token and interact with it 
async function transferToken(from, to, value) {
	const qrc20 = new ethers.Contract("0xc04d8b4f5137e5983b075e8560020523784c1c4a", QRC_ABI, signer)
	const deployment = qrc20.deploy({gasLimit: "0x2dc6c0", gasPrice: "0x28"})
	await deployment.deployed();
    const name = await qrc20.transfer(from, to, value, { gasLimit: "0x2dc6c0", gasPrice: "0x28"});
}

```


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

