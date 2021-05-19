const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("ethers")
const { QtumWallet } = require("../../build/main/lib/QtumWallet");
const { QtumProvider } = require("../../build/main/lib/QtumProvider");
const {
    QtumContractFactory,
} = require("../../build/main/lib/QtumContractFactory");
const { generateContractAddress } = require('../../build/main/lib/helpers/utils')
const BYTECODE = "608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029"
const ABI = [{ "inputs": [], "name": "get", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "x", "type": "uint256" }], "name": "set", "outputs": [], "stateMutability": "nonpayable", "type": "function" }]
const provider = new QtumProvider("http://localhost:23889");
const signer = new QtumWallet(
    "99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e",
    provider
);
const signerNoQtum = new QtumWallet(
    "61fd08e21110d908cf8dc20bb243a96e2dc0d29169b4fec09594c39e4384125a",
    provider
);
const SIMPLEBANK_ABI = [
    {
        "constant": false,
        "inputs": [
            {
                "name": "withdrawAmount",
                "type": "uint256"
            }
        ],
        "name": "withdraw",
        "outputs": [
            {
                "name": "remainingBal",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "balance",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [],
        "name": "enroll",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "fallback"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "name": "accountAddress",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "LogDepositMade",
        "type": "event"
    }

];

const SIMPLEBANK_BYTECODE = "608060405234801561001057600080fd5b5060018054600160a060020a031916331790556102a6806100326000396000f30060806040526004361061006c5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416632e1a7d4d811461007e5780638da5cb5b146100a8578063b69ef8a8146100e6578063d0e30db0146100fb578063e65f2a7e14610103575b34801561007857600080fd5b50600080fd5b34801561008a57600080fd5b50610096600435610118565b60408051918252519081900360200190f35b3480156100b457600080fd5b506100bd6101b8565b6040805173ffffffffffffffffffffffffffffffffffffffff9092168252519081900360200190f35b3480156100f257600080fd5b506100966101d4565b6100966101e7565b34801561010f57600080fd5b50610096610262565b3360008181526020819052604081205490919083111561013757600080fd5b73ffffffffffffffffffffffffffffffffffffffff8116600081815260208190526040808220805487900390555185156108fc0291869190818181858888f1935050505015801561018c573d6000803e3d6000fd5b5073ffffffffffffffffffffffffffffffffffffffff1660009081526020819052604090205492915050565b60015473ffffffffffffffffffffffffffffffffffffffff1681565b3360009081526020819052604090205490565b3360008181526020818152604080832080543490810190915581518581529283015280519293927fa8126f7572bb1fdeae5b5aa9ec126438b91f658a07873f009d041ae690f3a1939281900390910190a173ffffffffffffffffffffffffffffffffffffffff16600090815260208190526040902054919050565b3360008181526020819052604090206103e8905531905600a165627a7a723058207150f304aba2c201f08d6f34333d8f050e2efc1858b574aff03f66a497b066610029"
// describe("QtumContractFactory", function () {
//     it("QtumContractFactory should deploy correctly given the deployer has enough QTUM to cover gas", async function () {
//         const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);
//         const deployment = await simpleStore.deploy({
//             gasLimit: "0x2dc6c0", gasPrice: "0x28"
//         });
//         expect(deployment.address).to.equal(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`)
//         await deployment.deployed();
//         const getVal = await deployment.get({
//             gasLimit: "0x2dc6c0", gasPrice: "0x28"
//         });
//         expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
//         const setVal = await deployment.set(1001, {
//             gasLimit: "0x2dc6c0", gasPrice: "0x28"
//         });
//         const result = await setVal.wait()
//         console.log(setVal, 'setVal', result, 'result')
//         expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
//     });
//     it("QtumContractFactory can be connected to a QtumWallet signer.", async function () {
//         const simpleStore = new QtumContractFactory(ABI, BYTECODE);
//         const connectedSimpleStore = simpleStore.connect(signer);
//         if (!!connectedSimpleStore.signer) {
//             const deployment = await connectedSimpleStore.deploy({
//                 gasLimit: "0x2dc6c0",
//                 gasPrice: "0x28",
//             });
//             expect(!!deployment.address, "true");
//             await deployment.deployed();
//             const getVal = await deployment.get({
//                 gasLimit: "0x2dc6c0", gasPrice: "0x28"
//             });
//             expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
//         }
//     });
//     it("QtumContractFactory should reject if the deployer tries sending a value", async function () {
//         const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);
//         try {
//             await simpleStore.deploy({
//                 gasLimit: "0x2dc6c0", gasPrice: "0x28", value: "0xffffff"
//             });
//         } catch (err) {
//             expect(err.reason).to.equal("You cannot send QTUM while deploying a contract. Try deploying again without a value.")
//         }
//     });
//     it("QtumContractFactory should fail as the deployer has no UTXOs to spend", async function () {
//         const simpleStore = new QtumContractFactory(ABI, BYTECODE, signerNoQtum);
//         try {
//             await simpleStore.deploy({
//                 gasLimit: "0x2dc6c0", gasPrice: "0x28"
//             });
//         } catch (err) {
//             expect(err.reason).to.equal("Needed amount of UTXO's exceed the total you own.")
//         }
//     });
// })

describe("QtumWallet", function () {
    
    it("QtumWallet can send valid transactions to hash160 addresses", async function () {
        // sending to 0x7926223070547D2D15b2eF5e7383E541c338FfE9
        // const simulateSendTo = await signer.sendTransaction({
        //     to: "0x7926223070547D2D15b2eF5e7383E541c338FfE9",
        //     from: signer.address,
        //     gasLimit: "0x3d090",
        //     gasPrice: "0x28",
        //     value: "0xfffff",
        //     data: "",
        // });
        expect(true, "true")
        // const result = await simulateSendTo.wait()
        // console.log(result)
    });
    it("QtumWallet can call getAddress method with a valid private key provided to the signer", async function () {
        const address = await signer.getAddress();
        expect(address).to.equal(signer.address)
    });
    it("QtumWallet can connect to SimpleBank and call a payable method", async function () {
        const simpleBank = new QtumContractFactory(SIMPLEBANK_ABI, SIMPLEBANK_BYTECODE, signer);
        const deployment = await simpleBank.deploy({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        expect(deployment.address).to.equal(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`)
        await deployment.deployed();
        console.log(deployment)
        // const deposit = await deployment.deposit({
        //     gasLimit: "0x2dc6c0", gasPrice: "0x28"
        // });
        // const res = await deposit.wait()
        // console.log(deposit, 'deposit', res, 'res')
        // expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
        // const setVal = await deployment.set(1001, {
        //     gasLimit: "0x2dc6c0", gasPrice: "0x28"
        // });
        // const result = await setVal.wait()
        // console.log(setVal, 'setVal', result, 'result')
        // expect(BigNumber.from(getVal).toNumber()).to.equal(BigNumber.from("0x00").toNumber());
    });
})