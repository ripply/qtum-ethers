import { 
// BigNumber, 
Wallet } from "ethers";
// import {
//     resolveProperties,
//     Logger
// } from "ethers/lib/utils";
// import { TransactionRequest } from "@ethersproject/abstract-provider";
// import bitcoinjs = require("bitcoinjs-lib");
// import { encode as encodeCScriptInt } from "bitcoinjs-lib/src/script_number"
// import { BigNumber } from "bignumber.js"
// import { Buffer } from "buffer"
// import { OPS } from "./opcodes"
import { sha256, ripemd160 } from "hash.js";
export class QtumWallet extends Wallet {
    constructor() {
        // Assumptions for Gas
        // Contract Creation - GasLimit: 2500000, GasPrice: 40 (sats)
        super(...arguments);
        // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address
        this.getAddress = () => {
            const sha256Hash = sha256().update(super.publicKey, "hex").digest("hex");
            const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex");
            return Promise.resolve(`0x${prefixlessAddress}`);
        };
        //   public async getUtxos (from?: string, neededAmount?: number): Promise<IInput[]> {
        //     // const utxos = await axios.
        //     const result = await this.provider.send("qtum_getUTXOs", ["0x7926223070547D2D15b2eF5e7383E541c338FfE9", 1]);
        //     const bitcoinjsUTXOs: IInput[] = result.map((tx: any) => {
        //       return {address: tx['address'], txid: tx['txid'], hash: tx['txid'], pos: tx['vout'],
        //       scriptPubKey: tx['scriptPubKey'], amount: tx['amount'], value: tx['amount'] * 100000000, isStake: false, confirmations: tx['confirmations']
        //   }
        //     })
        //  return Promise.resolve(bitcoinjsUTXOs)
        //   }
        // }
        // ethGasToQtum(gasLimit: BigNumber, gasPrice: BigNumber): object {
        //   // const gasPriceDecimal: number | string = ethValueToQtumAmount(hexlify(gasPrice))
        //   // if err != nil {
        //   //   return nil, "0.0", err
        //   // }
        //   // gasPrice = fmt.Sprintf("%v", gasPriceDecimal)
        //   // return {gas: gasLimit, gasPrice: gasPriceDecimal}
        // }
        // func EthValueToQtumAmount(val string) (decimal.Decimal, error) {
        //   if val == "" {
        //     return decimal.NewFromFloat(0.0000004), nil
        //   }
        //   ethVal, err := utils.DecodeBig(val)
        //   if err != nil {
        //     return decimal.NewFromFloat(0.0), err
        //   }
        //   ethValDecimal, err := decimal.NewFromString(ethVal.String())
        //   if err != nil {
        //     return decimal.NewFromFloat(0.0), errors.New("decimal.NewFromString was not a success")
        //   }
        //   amount := ethValDecimal.Mul(decimal.NewFromFloat(float64(1e-8)))
        //   return amount, nil
        // }
        /**
       * Build a send-to-contract transaction
       *
       * @param keyPair
       * @param contractAddress
       * @param encodedData
       * @param feeRate Fee per byte of tx. (unit: value/ byte)
       * @param utxoList
       * @returns the built tx
       */
        // export function buildSendToContractTransaction(
        //   utxos: IInput[],
        //   keyPair: ECPair,
        //   contractAddress: string,
        //   encodedData: string,
        //   feeRate: number,
        //   opts: IContractSendTXOptions = {},
        // ): string {
        //   // feeRate must be an integer number, or coinselect would always fail
        //   feeRate = Math.floor(4000)
        //   // const gasLimit = opts.gasLimit || defaultContractSendTxOptions.gasLimit
        //   // const gasPrice = opts.gasPrice || defaultContractSendTxOptions.gasPrice
        //   // const amount = opts.amount || defaultContractSendTxOptions.amount
        //   // ensureAmountInteger(amount)
        //   const senderAddress = keyPair.getAddress()
        //   // excess gas will refund in the coinstake tx of the mined block
        //   const gasLimitFee = new BigNumber(250000).times(40).toNumber()
        //   const opcallScript = BTCScript.compile([
        //     OPS.OP_4,
        //     encodeCScriptInt(250000),
        //     encodeCScriptInt(40),
        //     Buffer.from(encodedData, "hex"),
        //     Buffer.from(contractAddress, "hex"),
        //     OPS.OP_CALL,
        //   ])
        //   const { inputs, fee: txfee } = coinSelect(
        //     utxos,
        //     [
        //       { value: gasLimitFee }, // gas fee
        //       { script: opcallScript, value: 0 }, // script + transfer amount to contract
        //     ],
        //     feeRate,
        //   )
        //   if (inputs == null) {
        //     throw new Error("could not find UTXOs to build transaction")
        //   }
        // const txb = new TransactionBuilder(keyPair.getNetwork())
        //   // add inputs to txb
        //   let vinSum = new BigNumber(0)
        //   for (const input of inputs) {
        //     txb.addInput(input.hash, input.pos)
        //     vinSum = vinSum.plus(input.value)
        //   }
        //   // send-to-contract output
        //   txb.addOutput(opcallScript, 0)
        //   // change output (in value
        //   const change = vinSum
        //     .minus(txfee)
        //     .minus(gasLimitFee)
        //     .minus(0)
        //     .toNumber()
        //   if (change > 0) {
        //     txb.addOutput(senderAddress, change)
        //   }
        //   for (let i = 0; i < inputs.length; i++) {
        //     txb.sign(i, keyPair)
        //   }
        //   return txb.build().toHex()
        // }
        // contractTx = () => {
        // }
        // private createContractTx = (data: string) => {
        //   // 250000 gasLimit, 40 gasPrice
        //   //   const createContractScript = BTCScript.compile([
        //   //   OPS.OP_4,
        //   //   encodeCScriptInt(250000),
        //   //   encodeCScriptInt(40),
        //   //   Buffer.from(data.split("0x")[1], "hex"),
        //   //   OPS.OP_CREATE,
        //   // ])
        //   const keyPair = bitcoinjs.ECPair.fromPrivateKey(Buffer.from(super.privateKey), {
        //     compressed: false,
        //     network: {
        //       messagePrefix: "\u0015Qtum Signed Message:\n",
        //       bech32: "",
        //       bip32: { public: 70617039, private: 70615956 },
        //       pubKeyHash: 120,
        //       scriptHash: 110,
        //       wif: 239
        //     }
        //   })
        // }
        this.signMessage = () => {
            return Promise.resolve("");
        };
        //Uncomment
        // selectUtxos = (utxos: Array<ListUTXOs>, neededAmount: number | string): (Array<TxVinWithNullScriptSig> & Array<BigNumber>) => {
        //     let balance: number = 0;
        //     let inputs: Array<TxVinWithNullScriptSig> = [];
        //     let amounts: Array<BigNumber> = [];
        //     for (let i = 0; i < utxos.length; i++) {
        //         balance += parseFloat(utxos[i].amount);
        //         inputs.push({ txid: Buffer.from(utxos[i].txid, 'hex'), vout: utxos[i].vout, hash: Buffer.from(utxos[i].txid.split("").reverse().join(), 'hex'), sequence: 0xffffffff, script: Buffer.from(utxos[i].scriptPubKey, "hex"), scriptSig: null })
        //         amounts.push(new BigNumber(parseFloat(utxos[i].amount).toString() + `e8`).toFixed(7))
        //         if (balance >= neededAmount) {
        //             break;
        //         }
        //     }
        //     return inputs, amounts;
        // }
        //   console.log(
        // The prevalent network fee is 0.004 per KB. If set to 100 times of norm, assume error. 
        //     Math.ceil((0.004 * 100 * 1e8) / 1024)
        // )
        // signTransaction = (transaction: TransactionRequest): Promise<string> => {
        //     return resolveProperties(transaction).then((tx) => {
        //         // Gas Price 
        //         let gasPrice: number | string;
        //         let gasLimit: number | string;
        //         let neededAmount: number | string;
        //         tx.gasPrice !== "" ? gasPrice = new BigNumber(parseInt("0x28".toString(), 16).toString() + `e-8`).toFixed(7) : gasPrice = 0.0000004;
        //         tx.gasLimit !== "" ? gasLimit = parseInt("0x3d090".toString(), 16) : gasLimit = 250000;
        //         tx.value !== "" ? neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt("0xffffff".toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7);
        //         // Create the unserialized transaction object
        //         let qtumTx: Tx = { version: 2, locktime: 0, vins: [], vouts: [] };
        //         // Check that the account has enough UTXO's for spending + gas 
        //         // @ts-ignore
        //         this.provider.getUtxos(tx.from, neededAmount).then((result) => {
        //             // Select the Vins
        //             const vins = this.selectUtxos(result, neededAmount);
        //             qtumTx.vins = vins;
        //             // Check if this is a deploy, call, or sendtoaddress TX
        //             if (tx.to == "" && tx.data != "") {
        //                 // Deploy 
        //                 return;
        //             }
        //             else if (tx.to != "" && tx.data != "") {
        //                 // Call
        //             }
        //             else {
        //                 // Send to address
        //             }
        //         }).catch((error: any) => {
        //             if (forwardErrors.indexOf(error.code) >= 0) {
        //                 throw error;
        //             }
        //             return logger.throwError(
        //                 "Needed amount of UTXO's exceed the total you own.",
        //                 Logger.errors.INSUFFICIENT_FUNDS,
        //                 {
        //                     error: error,
        //                 }
        //             );
        //         });
        //         // console.log(Promise.resolve(utxos))
        //         // let utxos = Promise.resolve(this.provider.getUtxos(tx.from, 1));
        //         // console.log(utxos)
        //         const sha256Hash = sha256().update(super.publicKey, "hex").digest("hex")
        //         const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex")
        //         return Promise.resolve(`0x${prefixlessAddress}`);
        //         let p2pkh =
        //             // https://github.com/ethers-io/ethers.js/blob/be4e2164e64dfa0697561763e8079120a485a566/packages/wallet/src.ts/index.ts#L110-L115
        //             // tx.to == "" && t.data != "", Creation
        //             // t.to != "" && t.data != "", Call
        //             console.log(tx)
        //         // if (tx.from != null) {
        //         //   const address = this.addressFromPublicKey(
        //         //     this.getKeyPair(this.privateKey()).pubkey
        //         //   );
        //         //   if (tx.from !== address) {
        //         //     // console.error(
        //         //     //   "transaction from address mismatch",
        //         //     //   "transaction.from",
        //         //     //   transaction.from
        //         //     // );
        //         //   }
        //         //   delete tx.from;
        //         // }
        //         // const signature = this.signMessage(
        //         //   keccak256(serialize(<UnsignedTransaction>tx))
        //         // );
        //         // return signature.then((value) =>
        //         //   serialize(<UnsignedTransaction>tx, value)
        //         // );
        //         return Promise.resolve("0x0200000001319ea8385fc5d297aa6ad7ab143b2ff99e1e27bb699071c53c14c0898a8cc4dd000000006a473044022006ea6c7fac79380c2771f98edfa4e2f99e706894962ec8afa2b5de59bb85228902205acfbbe77fd7513813a8916411c50b97f987dc9967819c77aedaeabf88b7dc3d0121030674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abffffffff02ffffff0f000000001976a9147926223070547d2d15b2ef5e7383e541c338ffe988ac00000000000000001976a914cdf409a70058bfc54ada1ee3422f1ef28d0d267d88ac00000000")
        //     });
        // };
    }
    async getContractAddressFromReceipt(hash) {
        // @ts-ignore
        const result = await this.provider.perform('eth_getTransactionReceipt', [hash]);
        return Promise.resolve(result.contractAddress);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUXR1bVdhbGxldC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvUXR1bVdhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPO0FBQ0gsY0FBYztBQUNkLE1BQU0sRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUMzQixXQUFXO0FBQ1gseUJBQXlCO0FBQ3pCLGFBQWE7QUFDYiw2QkFBNkI7QUFDN0IseUVBQXlFO0FBQ3pFLCtDQUErQztBQUMvQywrRUFBK0U7QUFDL0UsMkNBQTJDO0FBQzNDLGtDQUFrQztBQUNsQyxrQ0FBa0M7QUFDbEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxTQUFTLENBQUE7QUFpQzNDLE1BQU0sT0FBTyxVQUFXLFNBQVEsTUFBTTtJQUF0QztRQUVJLHNCQUFzQjtRQUN0Qiw2REFBNkQ7O1FBRzdELDZIQUE2SDtRQUU3SCxlQUFVLEdBQUcsR0FBb0IsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUE7WUFDeEUsTUFBTSxpQkFBaUIsR0FBRyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtZQUM3RSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDO1FBQ0Ysc0ZBQXNGO1FBQ3RGLG9DQUFvQztRQUNwQyxtSEFBbUg7UUFDbkgsaUVBQWlFO1FBQ2pFLDZGQUE2RjtRQUM3RixvSkFBb0o7UUFDcEosTUFBTTtRQUNOLFNBQVM7UUFDVCwwQ0FBMEM7UUFDMUMsTUFBTTtRQUNOLElBQUk7UUFDSixtRUFBbUU7UUFFbkUsd0ZBQXdGO1FBQ3hGLHVCQUF1QjtRQUN2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