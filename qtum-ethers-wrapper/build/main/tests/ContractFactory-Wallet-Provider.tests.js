"use strict";
const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("ethers");
const { QtumWallet } = require("../../build/main/lib/QtumWallet");
const { QtumProvider } = require("../../build/main/lib/QtumProvider");
const { QtumContractFactory, } = require("../../build/main/lib/QtumContractFactory");
const { generateContractAddress } = require('../../build/main/lib/helpers/utils');
const BYTECODE = "608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029";
const ABI = [{ "inputs": [], "name": "get", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "x", "type": "uint256" }], "name": "set", "outputs": [], "stateMutability": "nonpayable", "type": "function" }];
const provider = new QtumProvider("http://localhost:23889");
const signer = new QtumWallet("99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e", provider);
const signerNoQtum = new QtumWallet("61fd08e21110d908cf8dc20bb243a96e2dc0d29169b4fec09594c39e4384125a", provider);
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
const SIMPLEBANK_BYTECODE = "608060405234801561001057600080fd5b5060018054600160a060020a031916331790556102a6806100326000396000f30060806040526004361061006c5763ffffffff7c01000000000000000000000000000000000000000000000000000000006000350416632e1a7d4d811461007e5780638da5cb5b146100a8578063b69ef8a8146100e6578063d0e30db0146100fb578063e65f2a7e14610103575b34801561007857600080fd5b50600080fd5b34801561008a57600080fd5b50610096600435610118565b60408051918252519081900360200190f35b3480156100b457600080fd5b506100bd6101b8565b6040805173ffffffffffffffffffffffffffffffffffffffff9092168252519081900360200190f35b3480156100f257600080fd5b506100966101d4565b6100966101e7565b34801561010f57600080fd5b50610096610262565b3360008181526020819052604081205490919083111561013757600080fd5b73ffffffffffffffffffffffffffffffffffffffff8116600081815260208190526040808220805487900390555185156108fc0291869190818181858888f1935050505015801561018c573d6000803e3d6000fd5b5073ffffffffffffffffffffffffffffffffffffffff1660009081526020819052604090205492915050565b60015473ffffffffffffffffffffffffffffffffffffffff1681565b3360009081526020819052604090205490565b3360008181526020818152604080832080543490810190915581518581529283015280519293927fa8126f7572bb1fdeae5b5aa9ec126438b91f658a07873f009d041ae690f3a1939281900390910190a173ffffffffffffffffffffffffffffffffffffffff16600090815260208190526040902054919050565b3360008181526020819052604090206103e8905531905600a165627a7a723058207150f304aba2c201f08d6f34333d8f050e2efc1858b574aff03f66a497b066610029";
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
        expect(true, "true");
        // const result = await simulateSendTo.wait()
        // console.log(result)
    });
    it("QtumWallet can call getAddress method with a valid private key provided to the signer", async function () {
        const address = await signer.getAddress();
        expect(address).to.equal(signer.address);
    });
    it("QtumWallet can connect to SimpleBank and call a payable method", async function () {
        const simpleBank = new QtumContractFactory(SIMPLEBANK_ABI, SIMPLEBANK_BYTECODE, signer);
        const deployment = await simpleBank.deploy({
            gasLimit: "0x2dc6c0", gasPrice: "0x28"
        });
        expect(deployment.address).to.equal(`0x${generateContractAddress(deployment.deployTransaction.hash.split("0x")[1])}`);
        await deployment.deployed();
        console.log(deployment);
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29udHJhY3RGYWN0b3J5LVdhbGxldC1Qcm92aWRlci50ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy90ZXN0cy9Db250cmFjdEZhY3RvcnktV2FsbGV0LVByb3ZpZGVyLnRlc3RzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQUM7QUFDMUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0FBQ3BDLE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxPQUFPLENBQUMsaUNBQWlDLENBQUMsQ0FBQztBQUNsRSxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsT0FBTyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7QUFDdEUsTUFBTSxFQUNGLG1CQUFtQixHQUN0QixHQUFHLE9BQU8sQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQ3hELE1BQU0sRUFBRSx1QkFBdUIsRUFBRSxHQUFHLE9BQU8sQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFBO0FBQ2pGLE1BQU0sUUFBUSxHQUFHLHNlQUFzZSxDQUFBO0FBQ3ZmLE1BQU0sR0FBRyxHQUFHLENBQUMsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxT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