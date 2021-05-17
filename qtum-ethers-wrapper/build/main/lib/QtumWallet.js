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
                // Transform Hex Values
                let gasPrice;
                let gasLimit;
                let neededAmount;
                typeof tx.gasPrice !== "undefined" && tx.gasPrice !== "" ? gasPrice = new bignumber_js_1.BigNumber(ethers_1.BigNumber.from(tx.gasPrice).toNumber() + `e-8`).toFixed(7) : gasPrice = 0.0000004;
                typeof tx.gasLimit !== "undefined" && tx.gasLimit !== "" ? gasLimit = ethers_1.BigNumber.from(tx.gasLimit).toNumber() : gasLimit = 2500000;
                typeof tx.value !== "undefined" && tx.value !== "" ? neededAmount = new bignumber_js_1.BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new bignumber_js_1.BigNumber(gasPrice).times(gasLimit).toFixed(7);
                // Create the transaction object
                let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
                // Check that the account has enough UTXO's for spending + gas 
                // @ts-ignore
                const serializedTransaction = this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                    // Select the Vins
                    let [vins, amounts] = utils_2.addVins(result, neededAmount, hash160PubKey);
                    qtumTx.vins = vins;
                    // Check if this is a deploy, call, or sendtoaddress TX
                    if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                        // Deploy 
                        // Add the Vouts
                        // @ts-ignore
                        qtumTx.vouts = utils_2.addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), gasLimit, tx.data, "", amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result1 = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result1, "result");
                        return result1;
                    }
                    else if ((tx.to == "" || tx.to == undefined) && tx.data != "" && tx.value !== "") {
                        return logger.throwError("You cannot send QTUM while deploying a contract.", utils_1.Logger.errors.NOT_IMPLEMENTED, {
                            error: "You cannot send QTUM while deploying a contract.",
                        });
                    }
                    else if (tx.to != "" && tx.data != "") {
                        // Call
                        // Add the Vouts
                        // @ts-ignore
                        qtumTx.vouts = utils_2.addContractVouts(40, 250000, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result1 = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result1, "result");
                        return result1;
                    }
                    else {
                        // Send to address
                        const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                        const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
                        // @ts-ignore
                        const sha256HashAddress = hash_js_1.sha256().update(tx.to.split("0x")[1], "hex").digest("hex");
                        const hash160Address = hash_js_1.ripemd160().update(sha256HashAddress, "hex").digest("hex");
                        qtumTx.vouts = utils_2.addp2pkhVouts(hash160Address, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result1 = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result1, "result");
                        return result1;
                    }
                }).catch((error) => {
                    if (forwardErrors.indexOf(error.code) >= 0) {
                        throw error;
                    }
                    return logger.throwError("Needed amount of UTXO's exceed the total you own.", utils_1.Logger.errors.INSUFFICIENT_FUNDS, {
                        error: error,
                    });
                });
                console.log(serializedTransaction, 'here');
                return serializedTransaction;
            });
        };
    }
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBNEU7QUFDNUUsNENBRzBCO0FBRTFCLCtDQUF3QztBQUN4QyxxQ0FBMkM7QUFDM0MsbUNBQTZHO0FBRTdHLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLGNBQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFHRixNQUFhLFVBQVcsU0FBUSxlQUFNO0lBQXRDO1FBRUksNkhBQTZIOztRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBRUYsb0JBQWUsR0FBRyxDQUFDLFdBQStCLEVBQW1CLEVBQUU7WUFDbkUsT0FBTyx5QkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRTtnQkFDOUMsdUJBQXVCO2dCQUN2QixJQUFJLFFBQXlCLENBQUM7Z0JBQzlCLElBQUksUUFBZ0IsQ0FBQztnQkFDckIsSUFBSSxZQUFvQixDQUFDO2dCQUN6QixPQUFPLEVBQUUs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