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
            return this.populateTransaction(transaction).then((transactionRequest) => {
                return utils_1.resolveProperties(transactionRequest).then((tx) => {
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
                            qtumTx.vouts = utils_2.addContractVouts(ethers_1.BigNumber.from(tx.gasPrice).toNumber(), gasLimit, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
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
            });
        };
    }
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBOEQ7QUFDOUQsNENBRzBCO0FBRTFCLCtDQUF3QztBQUN4QyxxQ0FBMkM7QUFDM0MsbUNBQTZHO0FBRTdHLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLGNBQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFHRixNQUFhLFVBQVcsU0FBUSxlQUFNO0lBQXRDO1FBRUksNkhBQTZIOztRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBRUYsb0JBQWUsR0FBRyxDQUFDLFdBQStCLEVBQW1CLEVBQUU7WUFDbkUsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEVBQUUsRUFBRTtnQkFDckUsT0FBTyx5QkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFO29CQUNyRCx1QkFBdUI7b0JB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