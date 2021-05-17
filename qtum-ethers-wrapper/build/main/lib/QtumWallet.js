"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QtumWallet = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const bignumber_js_1 = require("bignumber.js");
const hash_js_1 = require("hash.js");
const utils_2 = require("./utils");
const logger = new utils_1.Logger("QtumWallet");
const forwardErrors = [
    utils_1.Logger.errors.INSUFFICIENT_FUNDS
];
class QtumWallet extends ethers_1.Wallet {
    constructor() {
        // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address
        super(...arguments);
        this.getAddress = () => {
            const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
            const prefixlessAddress = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
            return Promise.resolve(`0x${prefixlessAddress}`);
        };
        this.signTransaction = (transaction) => {
            return utils_1.resolveProperties(transaction).then((tx) => {
                console.log("madeitHERE");
                // Transform Hex Values
                let gasPrice;
                let gasLimit;
                let neededAmount;
                tx.gasPrice !== "" ? gasPrice = new bignumber_js_1.BigNumber(parseInt(tx.gasPrice.toString(), 16).toString() + `e-8`).toFixed(7) : gasPrice = new bignumber_js_1.BigNumber(parseInt("0x28".toString(), 16).toString() + `e-8`).toFixed(7);
                tx.gasLimit !== "" ? gasLimit = ethers_1.BigNumber.from(tx.gasLimit).toNumber() : gasLimit = 250000;
                tx.value !== "" ? neededAmount = new bignumber_js_1.BigNumber(gasPrice).times(gasLimit).plus(parseInt("0xffffff".toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new bignumber_js_1.BigNumber(gasPrice).times(gasLimit).plus(parseInt("0xffffff".toString(), 16).toString() + `e-8`).toFixed(7);
                // Create the transaction object
                let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
                console.log(neededAmount);
                // Check that the account has enough UTXO's for spending + gas 
                // @ts-ignore
                this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                    console.log("here3");
                    // Select the Vins
                    let [vins, amounts] = utils_2.addVins(result, neededAmount, hash160PubKey);
                    qtumTx.vins = vins;
                    // Check if this is a deploy, call, or sendtoaddress TX
                    if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                        console.log("deploy");
                        // Deploy 
                        // Add the Vouts
                        let buffData = utils_2.generateContractAddress();
                        const buffDataHashed = hash_js_1.sha256().update(buffData, "hex").digest("hex");
                        const addy = hash_js_1.ripemd160().update(buffDataHashed, "hex").digest("hex");
                        // let addy = ripemd160().update(sha256().update(buffData, "hex").digest("hex")).digest("hex");
                        console.log(addy);
                        // @ts-ignore
                        qtumTx.vouts = utils_2.addContractVouts(40, 2500000, tx.data, "", amounts, 1.003, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result, "resulttt");
                        return;
                    }
                    else if ((tx.to == "" || tx.to == undefined) && tx.data != "" && tx.value !== "") {
                        console.log("deployError");
                        return logger.throwError("You cannot send QTUM while deploying a contract.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                            error: "You cannot send QTUM while deploying a contract.",
                        });
                    }
                    else if (tx.to != "" && tx.data != "") {
                        console.log("call");
                        // Call
                        // Add the Vouts
                        // @ts-ignore
                        qtumTx.vouts = utils_2.addContractVouts(40, 250000, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        return;
                    }
                    else {
                        console.log("sendtoadd");
                        // Send to address
                        console.log("mmmm");
                        const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                        const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
                        const sha256HashAddress = hash_js_1.sha256().update(tx.to.split("0x")[1], "hex").digest("hex");
                        const hash160Address = hash_js_1.ripemd160().update(sha256HashAddress, "hex").digest("hex");
                        qtumTx.vouts = utils_2.addp2pkhVouts(hash160Address, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result, "resulttt");
                        return;
                    }
                }).catch((error) => {
                    if (forwardErrors.indexOf(error.code) >= 0) {
                        throw error;
                    }
                    return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                        error: error,
                    });
                });
                return Promise.resolve(`020000000100d88aad446a825f03ac08cb870ff963bb0921edfed70356c61ab04205cda4a5000000008a47304402207c2ddfd9209af61ea0adfcd9e998d84ed75e00f6b1e074add58f3b32e2a254f4022060d3c7eb62a2d3e48e526c465dd90b101f15ff9a42d137b98747ebf933b68f710141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503ffffffff010000000000000000fdfd00010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c100000000`);
            });
        };
    }
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBOEQ7QUFDOUQsNENBRzBCO0FBRTFCLCtDQUF3QztBQUN4QyxxQ0FBMkM7QUFDM0MsbUNBQXNJO0FBRXRJLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLGNBQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFHRixNQUFhLFVBQVcsU0FBUSxlQUFNO0lBQXRDO1FBRUksNkhBQTZIOztRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBRUYsb0JBQWUsR0FBRyxDQUFDLFdBQStCLEVBQW1CLEVBQUU7WUFDbkUsT0FBTyx5QkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRTtnQkFDOUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQTtnQkFDekIsdUJBQXVCO2dCQUN2QixJQUFJLFFBQWdCLENBQUM7Z0JBQ3JCLElBQUksUUFBZ0IsQ0FB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