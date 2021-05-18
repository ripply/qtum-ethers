const { expect } = require("chai");
const { QtumWallet } = require("../../build/main/lib/QtumWallet");
const { QtumProvider } = require("../../build/main/lib/QtumProvider");
const {
    QtumContractFactory,
} = require("../../build/main/lib/QtumContractFactory");

const BYTECODE = "608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029"
const ABI = [{ "inputs": [], "name": "get", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "x", "type": "uint256" }], "name": "set", "outputs": [], "stateMutability": "nonpayable", "type": "function" }]
const provider = new QtumProvider("http://localhost:23889");
const signer = new QtumWallet(
    "99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e",
    provider
);

describe("SimpleStore", function () {
    it("QtumContractFactory should deploy correctly given the deployer has enough QTUM to cover gas", async function () {
        const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);
        const deployment = await simpleStore.deploy({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        console.log(deployment)
        expect(true, "true")
    });
})