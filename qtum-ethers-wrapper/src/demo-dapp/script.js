const { ethers } = require("ethers");
const { QtumWallet } = require("../../build/main/lib/QtumWallet");
const { QtumProvider } = require("../../build/main/lib/QtumProvider");
const {
  QtumContractFactory,
} = require("../../build/main/lib/QtumContractFactory");

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
  // const connectedContractFactory = simpleStore.connect(signer);
  // if (!!connectedContractFactory.signer) {
  //   const deployment = await connectedContractFactory.deploy({
  //     gasLimit: "0x2dc6c0",
  //     gasPrice: "0x28",
  //   });
  //   console.log("true");
  //   expect(!!deployment.address, "true");
  // } else {
  //   console.log(false, connectedContractFactory.connect(signer));
  // }
  // const simpleStore = new QtumContractFactory(ABI, BYTECODE, signer);
  // const deployment = await simpleStore.deploy({
  //   gasLimit: "0x2dc6c0"
  // })
  // console.log(deployment.address)
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
  //   "0x865c45279552bfed54bd493d9676ff88fd16620d",
  //   ABI,
  //   signer
  // );
  // const setSimpleStore = await simpleStore.get({
  //   gasLimit: "0x3d090",
  //   gasPrice: "0x28",
  // });
  // console.log(setSimpleStore);

  // const getSimpleStore = await simpleStore.get({
  //   gasLimit: "0x3d090",
  //   gasPrice: "0x28",
  // });
  // console.log(getSimpleStore);
  // const addy = signer.address;
  // console.log(addy);
  // const addy2 = await signer.getAddress();
  // console.log(addy2);
  // const simulateSendTo = await signer.sendTransaction({
  //   to: "0x30a41759e2fec594fbb90ea2b212c9ef8074e227",
  //   from: addy,
  //   gasLimit: "0x3d090",
  //   gasPrice: "0x28",
  //   value: "0xfffff",
  //   data: "",
  // });
  // const sent = await simulateSendTo.wait()
  // console.log(sent)
}
main();
