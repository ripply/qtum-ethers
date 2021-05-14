"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QtumWallet = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
// import { encode as encodeCScriptInt } from "bitcoinjs-lib/src/script_number"
const bignumber_js_1 = require("bignumber.js");
const buffer_1 = require("buffer");
// import { OPS } from "./opcodes"
const hash_js_1 = require("hash.js");
const utils_2 = require("./utils");
// https://blog.qtum.org/wallet-import-format-3497f670b6aa
// OP_CREATE = byte(0xc1)
// OP_CALL   = byte(0xc2)
const logger = new utils_1.Logger("QtumWallet");
const forwardErrors = [
    utils_1.Logger.errors.INSUFFICIENT_FUNDS
];
class QtumWallet extends ethers_1.Wallet {
    constructor() {
        // Assumptions for Gas
        // Contract Creation - GasLimit: 2500000, GasPrice: 40 (sats)
        super(...arguments);
        // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address
        this.getAddress = () => {
            const sha256Hash = hash_js_1.sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex");
            const prefixlessAddress = hash_js_1.ripemd160().update(sha256Hash, "hex").digest("hex");
            return Promise.resolve(`0x${prefixlessAddress}`);
        };
        this.signMessage = () => {
            return Promise.resolve("");
        };
        this.addVins = (utxos, neededAmount) => {
            let balance = 0;
            let inputs = [];
            let amounts = [];
            for (let i = 0; i < utxos.length; i++) {
                let reverseHash = utxos[i].txid.split("").reverse().join("");
                console.log(utxos[i].txid, reverseHash);
                balance += parseFloat(utxos[i].amount);
                console.log(utils_2.reverse(buffer_1.Buffer.from(utxos[i].txid, 'hex')));
                inputs.push({ txid: buffer_1.Buffer.from(utxos[i].txid, 'hex'), vout: utxos[i].vout, hash: utils_2.reverse(buffer_1.Buffer.from(utxos[i].txid, 'hex')), sequence: 0xffffffff, script: buffer_1.Buffer.from(utxos[i].scriptPubKey, "hex"), scriptSig: null });
                // amounts.push(new BigNumber(parseFloat(utxos[i].amount).toString() + `e8`).toFixed(7));
                amounts.push(parseFloat(utxos[i].amount));
                if (balance >= neededAmount) {
                    break;
                }
            }
            return [inputs, amounts];
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
                    let [vins, amounts] = this.addVins(result, 0.1);
                    qtumTx.vins = vins;
                    // Check if this is a deploy, call, or sendtoaddress TX
                    if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                        // Deploy 
                        // Add the Vouts
                        // qtumTx.vouts = this.addDeployVouts(BigNumberEthers.from(gasPrice).toNumber(), BigNumberEthers.from(gasLimit).toNumber(), tx.data, amounts)
                        const bufferObj = utils_2.generateContractAddress();
                        const sha256Hash = hash_js_1.sha256().update(bufferObj).digest();
                        const contractAddy = hash_js_1.ripemd160().update(sha256Hash).digest("hex");
                        console.log(contractAddy, 'contractAddy');
                        qtumTx.vouts = this.addDeployVouts(40, 2500000, tx.data, amounts, 0.1);
                        // console.log("here1",qtumTx)
                        // let buf = p2pkhScriptSig(signp2pkh(qtumTx, 0, this.privateKey, 0x1), this.publicKey);
                        // console.log(buf, "buf")
                        // const sig = this._signingKey().signDigest(buf);
                        // console.log(sig, "sigggg")
                        // console.log("sig", sig)
                        // qtumTx.vins[0].scriptSig = buf
                        // qtumTx.vins.map((vinput: any, index: number) => {
                        //     console.log('hereeeee')
                        //     return {...vinput, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x1), this.publicKey)};
                        // })
                        console.log(qtumTx);
                        let result = utils_2.txToBuffer(qtumTx).toString('hex');
                        console.log(result);
                        return;
                    }
                    else if (tx.to != "" && tx.data != "") {
                        // Call
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
                return Promise.resolve(`0x`);
            });
        };
    }
    async getContractAddressFromReceipt(hash) {
        // @ts-ignore
        const result = await this.provider.perform('eth_getTransactionReceipt', [hash]);
        return Promise.resolve(result.contractAddress);
    }
}
exports.QtumWallet = QtumWallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBOEQ7QUFDOUQsNENBSTBCO0FBRzFCLCtFQUErRTtBQUMvRSwrQ0FBd0M7QUFDeEMsbUNBQStCO0FBQy9CLGtDQUFrQztBQUNsQyxxQ0FBMkM7QUFHM0MsbUNBQTRKO0FBRTVKLDBEQUEwRDtBQUMxRCx5QkFBeUI7QUFDekIseUJBQXlCO0FBQ3pCLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRXhDLE1BQU0sYUFBYSxHQUFHO0lBQ2xCLGNBQU0sQ0FBQyxNQUFNLENBQUMsa0JBQWtCO0NBQ25DLENBQUM7QUFtQkYsTUFBYSxVQUFXLFNBQVEsZUFBTTtJQUF0QztRQUVJLHNCQUFzQjtRQUN0Qiw2REFBNkQ7O1FBRzdELDZIQUE2SDtRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxnQkFBTSxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUN2RixNQUFNLGlCQUFpQixHQUFHLG1CQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBRUYsZ0JBQVcsR0FBRyxHQUFvQixFQUFFO1lBQ2hDLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMvQixDQUFDLENBQUE7UUFNRCxZQUFPLEdB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