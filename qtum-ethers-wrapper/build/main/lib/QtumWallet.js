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
        this.addDeployVouts = (gasPrice, gasLimit, data, amounts, neededAmount) => {
            let vouts = [];
            let networkFee = 0.0018;
            let returnAmount = amounts.reduce((a, b) => a + b);
            const sha256Hash = hash_js_1.sha256().update(super.publicKey, "hex").digest("hex");
            const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
            console.log(data);
            vouts.push({
                script: utils_2.contractTxScript("", gasLimit, gasPrice, data.split("0x")[1]),
                value: 0
            });
            // vouts.push({
            //     script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
            //     value: new BigNumber(returnAmount).minus(neededAmount).minus(networkFee).times(1e8).toNumber()
            // })
            return vouts;
        };
        this.addCallVouts = (gasPrice, gasLimit, data, address, amounts, value) => {
            let vouts = [];
            let networkFee = 0.0018;
            let returnAmount = amounts.reduce((a, b) => a + b);
            const sha256Hash = hash_js_1.sha256().update(super.publicKey, "hex").digest("hex");
            const hash160PubKey = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
            console.log(data);
            vouts.push({
                script: utils_2.contractTxScript(address, gasLimit, gasPrice, data.split("0x")[1]),
                value: 0
            });
            // vouts.push({
            //     script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
            //     value: new BigNumber(returnAmount).minus(neededAmount).minus(networkFee).times(1e8).toNumber()
            // })
            return vouts;
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
                // Check that the account has enough UTXO's for spending + gas 
                // @ts-ignore
                this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                    // Select the Vins
                    let [vins, amounts] = utils_2.addVins(result, 0.1);
                    qtumTx.vins = vins;
                    // Check if this is a deploy, call, or sendtoaddress TX
                    if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                        // Deploy 
                        // Add the Vouts
                        const bufferObj = utils_2.generateContractAddress();
                        // console.log("sha256HashFirst", sha256HashFirst)
                        const sha256Hash = hash_js_1.sha256().update(bufferObj).digest("hex");
                        const contractAddy = hash_js_1.ripemd160().update(sha256Hash).digest("hex");
                        // console.log(contractAddy, 'contractAddy')
                        qtumTx.vouts = this.addDeployVouts(40, 2500000, tx.data, amounts, 0.1);
                        // const sig = this._signingKey().signDigest(buf);
                        qtumTx.vins[0].scriptSig = utils_2.p2pkhScriptSig(utils_2.signp2pkh(qtumTx, 0, this.privateKey, 0x01), this.publicKey.split("0x")[1]);
                        // qtumTx.vins.map((vinput: any, index: number) => {
                        //     return {...vinput, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x1), this.publicKey)};
                        // })
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result, "resulttt");
                        return;
                    }
                    else if (tx.to != "" && tx.data != "") {
                        // Call
                        // Add the Vouts
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
                return Promise.resolve(`0200000001009420231563fe146132283e64115f2b60fbc59e3b6dbc3b25021b15cd56a2ca000000008a473044022059d459b80388eb5ba4cfafede69938b70ac04a9f834139f81162668ca0c7dbcd022062a415570c99b43187943a50483f6923bf03decc2c2375580fb4b071caf3b0a10141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503ffffffff010000000000000000fdfd00010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c100000000`);
            });
        };
    }
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBOEQ7QUFDOUQsNENBRzBCO0FBRTFCLCtDQUF3QztBQUV4QyxxQ0FBMkM7QUFDM0MsbUNBQWlJO0FBRWpJLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLGNBQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFPRixNQUFhLFVBQVcsU0FBUSxlQUFNO0lBQXRDO1FBRUksNkhBQTZIOztRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBRUYsbUJBQWMsR0FBRyxDQUFDLFFBQWdCLEVBQUUsUUFBZ0IsRUFBRSxJQUFZLEVBQUUsT0FBbUIsRUFBRSxZQUFvQixFQUFnQixFQUFFO1lBQzNILElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUNmLElBQUksVUFBVSxHQUFHLE1BQU0sQ0FBQztZQUN4QixJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFB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