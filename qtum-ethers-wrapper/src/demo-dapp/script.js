const { ethers } = require("ethers");
const { QtumWallet } = require("../../build/main/lib/QtumWallet");
const { QtumProvider } = require("../../build/main/lib/QtumProvider");

const provider = new QtumProvider("http://localhost:23889");
const ethProvider = new ethers.providers.JsonRpcProvider(
  "https://ropsten.infura.io/v3/f935df20884e44449345fe2d6e035171"
);
const signer = new QtumWallet(
  "99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e",
  provider
);
const regSigner = new ethers.Wallet(
  "99dda7e1a59655c9e02de8592be3b914df7df320e72ce04ccf0427f9a366ec6e",
  ethProvider
);
const BYTECODE =
  "608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029";
const ABI = [
  {
    inputs: [],
    name: "get",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "x", type: "uint256" }],
    name: "set",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function main() {
  // const simpleStore = new ethers.ContractFactory(ABI, BYTECODE, signer);
  // const deployment = await simpleStore.deploy({
  //   gasLimit: "0x2dc6c0",
  // });
  // console.log(deployment);
  //   const simpleStoreRegSigner = new ethers.ContractFactory(
  //     ABI,
  //     BYTECODE,
  //     regSigner
  //   );
  //   const deploymentReg = await simpleStoreRegSigner.deploy({
  //     gasLimit: "0x2dc6c0", value: "0x64"
  // });
  //   console.log(deploymentReg);
  // const simpleStore = new ethers.Contract(
  //   "0x40f1c39b8914c6790145c17ce94476cffbc0eda8",
  //   ABI,
  //   signer
  // );
  // const setSimpleStore = await simpleStore.set(100, {
  //   gasLimit: "0x3d090",
  //   gasPrice: "0x28",
  // });
  // console.log(setSimpleStore);
  const simulateSendTo = await signer.sendTransaction(
    {
      "to": "0x7926223070547D2D15b2eF5e7383E541c338FfE9",
      "from": "0xcca81b02942d8079a871e02ba03a3a4a8d7740d2",
      "gasLimit": "0x3d090",
      "gasPrice": "0x28",
      "value": "0xffffff",
      "data": ""
    }
  )
  // console.log(simulateSendTo)
  const addy = await signer.getAddress()
  console.log(addy)
}
main();
