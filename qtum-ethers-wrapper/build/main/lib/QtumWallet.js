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
                tx.gasPrice !== "" ? gasPrice = new bignumber_js_1.BigNumber(parseInt(tx.gasPrice.toString(), 16).toString() + `e-8`).toFixed(7) : gasPrice = 0.0000004;
                tx.gasLimit !== "" ? gasLimit = ethers_1.BigNumber.from(tx.gasLimit).toNumber() : gasLimit = 250000;
                tx.value !== "" ? neededAmount = new bignumber_js_1.BigNumber(gasPrice).times(gasLimit).plus(parseInt("0xffffff".toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new bignumber_js_1.BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7);
                // Create the transaction object
                let qtumTx = { version: 2, locktime: 0, vins: [], vouts: [] };
                const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
                const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
                // Check that the account has enough UTXO's for spending + gas 
                // @ts-ignore
                this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                    // Select the Vins
                    let [vins, amounts] = utils_2.addVins(result, 1.002);
                    qtumTx.vins = vins;
                    // Check if this is a deploy, call, or sendtoaddress TX
                    if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                        // Deploy 
                        // Add the Vouts
                        // const bufferObj = generateContractAddress();
                        // const sha256Hash = sha256().update(bufferObj).digest("hex")
                        // const contractAddy = ripemd160().update(sha256Hash).digest("hex")
                        // console.log(contractAddy, 'contractAddy')
                        qtumTx.vouts = utils_2.addVouts(40, 2500000, tx.data, "", amounts, 1.002, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result, "resulttt");
                        return;
                    }
                    else if (tx.to != "" && tx.data != "") {
                        // Call
                        // Add the Vouts
                        qtumTx.vouts = utils_2.addVouts(40, 2500000, tx.data, tx.to, amounts, neededAmount, hash160PubKey);
                        let updatedVins = qtumTx.vins.map((vin, index) => {
                            return Object.assign(Object.assign({}, vin), { ['scriptSig']: utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, index, this.privateKey, 0x01), this.publicKey.split("0x")[1]) });
                        });
                        qtumTx.vins = updatedVins;
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result, "resulttt");
                        return;
                    }
                    else {
                        // Send to address
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBOEQ7QUFDOUQsNENBRzBCO0FBRTFCLCtDQUF3QztBQUV4QyxxQ0FBMkM7QUFDM0MsbUNBQXVKO0FBRXZKLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLGNBQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFPRixNQUFhLFVBQVcsU0FBUSxlQUFNO0lBQXRDO1FBRUksNkhBQTZIOztRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBRUYsb0JBQWUsR0FBRyxDQUFDLFdBQStCLEVBQW1CLEVBQUU7WUFDbkUsT0FBTyx5QkFBaUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRTtnQkFDOUMsdUJBQXVCO2dCQUN2QixJQUFJLFFBQXlCLENBQUM7Z0JBQzlCLElBQUksUUFBeUIsQ0FBQztnQkFDOUIsSUFBSSxZQUFvQixDQUFDO2dCQUN6QixFQUFFLENBQUMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLElBQUksd0JBQVMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUM7Z0JBQ3pJLEVBQUUsQ0FBQyxRQUFRLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsa0JBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDO2dCQUNqRyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxHQUFHLElBQUksd0JBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLEdBQUcsSUFBSSx3QkFBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoUixnQ0FBZ0M7Z0JBQ2hDLElBQUksTUFBTSxHQUFPLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxD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