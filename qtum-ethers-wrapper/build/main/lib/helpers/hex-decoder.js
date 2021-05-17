"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decode = void 0;
const bitcoinjs = require('bitcoinjs-lib');
/**
 * Decode utxo hex.
 * @param {string} hex
 */
function decode(hex) {
    let tx = bitcoinjs.Transaction.fromHex(hex);
    tx.ins.forEach((input) => {
        if (input.witness.length > 0) {
            input.type = 'Segwit';
            input.witness = decodeWitness(input.witness);
            input.script = {
                hex: input.script.toString('hex')
            };
        }
        else {
            let decodedScript = bitcoinjs.script.toASM(input.script).split(" ");
            if (decodedScript.length === 2) {
                input.type = 'P2PKH';
                input.script = {
                    signature: decodedScript[0],
                    publicKey: decodedScript[1]
                };
            }
            else {
                input.type = 'Unkown';
                input.script = {
                    hex: decodedScript
                };
            }
        }
        input.hash = input.hash.toString('hex');
    });
    tx.outs.forEach((output) => {
        console.log(bitcoinjs.script.toASM(bitcoinjs.script.decompile(Buffer.from("540390d00301282460fe47b100000000000000000000000000000000000000000000000000000000000003ea14f6287c7a0ea0389c9f7cba86d7e08b804ae163f3c2", "hex"))), 'output.script');
        output.script = bitcoinjs.script.toASM(output.script);
    });
    tx.totalValue = sumOutputValue(tx);
    return tx;
}
exports.decode = decode;
;
/**
 * Sum value (satoshi) in all outputs
 * @param {Transaction} tx
 * @returns {number} satoshis
 */
function sumOutputValue(tx) {
    let totalValue = 0;
    if (tx && tx.outs && tx.outs.length > 0) {
        totalValue = tx.outs.map((out) => out.value).reduce(reducer);
    }
    return totalValue;
}
/**
 * convert witness hex array to object
 * @param {Array} witness
 * @return {signature: string, publicKey: string, hashType:number}
 */
function decodeWitness(witness) {
    const { signature: sigBuf, hashType } = bitcoinjs.script.signature.decode(witness[0]);
    const signature = sigBuf.toString('hex');
    const publicKey = witness[1].toString('hex');
    return { signature, publicKey, hashType };
}
function reducer(a, b) { return a + b; }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGV4LWRlY29kZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2hlbHBlcnMvaGV4LWRlY29kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBRzNDOzs7R0FHRztBQUNILFNBQWdCLE1BQU0sQ0FBRSxHQUFXO0lBQ2pDLElBQUksRUFBRSxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBRTNDLEVBQUUsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUU7UUFDNUIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUM7WUFDM0IsS0FBSyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUE7WUFDckIsS0FBSyxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQzVDLEtBQUssQ0FBQyxNQUFNLEdBQUc7Z0JBQ2IsR0FBRyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQzthQUNsQyxDQUFBO1NBQ0Y7YUFBTTtZQUNMLElBQUksYUFBYSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDbkUsSUFBRyxhQUFhLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBQztnQkFDNUIsS0FBSyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUE7Z0JBQ3BCLEtBQUssQ0FBQyxNQUFNLEdBQUc7b0JBQ2IsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7b0JBQzNCLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDO2lCQUM1QixDQUFBO2FBQ0Y7aUJBQ0c7Z0JBQ0YsS0FBSyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUE7Z0JBQ3JCLEtBQUssQ0FBQyxNQUFNLEdBQUc7b0JBQ2IsR0FBRyxFQUFFLGFBQWE7aUJBQ25CLENBQUE7YUFDRjtTQUNGO1FBQ0QsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUN6QyxDQUFDLENBQUMsQ0FBQTtJQUVGLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBVyxFQUFFLEVBQUU7UUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHNJQUFzSSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQTtRQUM5TyxNQUFNLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUN2RCxDQUFDLENBQUMsQ0FBQTtJQUVGLEVBQUUsQ0FBQyxVQUFVLEdBQUcsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0lBRWxDLE9BQU8sRUFBRSxDQUFDO0FBQ1osQ0FBQztBQXJDRCx3QkFxQ0M7QUFBQSxDQUFDO0FBRUY7Ozs7R0FJRztBQUNILFNBQVMsY0FBYyxDQUFFLEVBQU87SUFDOUIsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0lBQ25CLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3ZDLFVBQVUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQTtLQUNsRTtJQUNELE9BQU8sVUFBVSxDQUFBO0FBQ25CLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxhQUFhLENBQUMsT0FBbUI7SUFDeEMsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQ3JGLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUE7SUFDeEMsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUM1QyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsQ0FBQTtBQUMzQyxDQUFDO0FBRUQsU0FBUyxPQUFPLENBQUMsQ0FBTSxFQUFFLENBQU0sSUFBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBQSxDQUFDIn0=