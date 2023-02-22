import {Contract, ContractFactory, Provider, utils, Wallet} from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { AbiCoder } from "ethers/lib/utils";
const fs = require("fs");

const hre = require("hardhat");
const Web3 = require("web3");
hre.web3 = new Web3(hre.network.provider);

var config = {
  EthCrossChainManager: undefined,
  EthCrossChainManagerProxy: undefined,
  EthCrossChainData: undefined,
  LockProxy: undefined,
  WrapperV3: undefined,
  Name: undefined
};

var configPath = './polyConfig.json';
// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  // Initialize the wallet.
  const wallet = new Wallet(hre.config.networks[hre.network.name].priv);
  let provider = new Provider(hre.config.networks[hre.network.name].url)
  const SUPPORTED_L1_TESTNETS = ['mainnet', 'rinkeby', 'ropsten', 'kovan', 'goerli'];
  const ethNetwork = hre.config.networks[hre.network.name].ethNetwork;
  const ethWeb3Provider = SUPPORTED_L1_TESTNETS.includes(ethNetwork)
      ? ethers.getDefaultProvider(ethNetwork)
      : new ethers.providers.JsonRpcProvider(ethNetwork);
  const zkWeb3Provider = new Provider(hre.config.networks[hre.network.name].url);
  let zkWallet = wallet.connect(zkWeb3Provider).connectToL1(ethWeb3Provider);

  const polyId_zk = hre.config.networks[hre.network.name].polyId;
  const deployer = new Deployer(hre, wallet);
  await readConfig(deployer.hre.network.name).then((netConfig) => {
    if (netConfig !== undefined) {
      config = netConfig
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
  if (config.Name === undefined) {
    config.Name = hre.network.name
  }

  // Create deployer object and load the artifact of the contract we want to deploy.
  const CCD = await deployer.loadArtifact("EthCrossChainData");
  const CCM = await deployer.loadArtifact("EthCrossChainManager");
  const CCMP = await deployer.loadArtifact("EthCrossChainManagerProxy");
  const LockProxy = await deployer.loadArtifact("LockProxy");
  const WrapperV3 = await deployer.loadArtifact("WrapperV3");
  let ccd
  let ccm
  let ccmp
  let lockproxy
  let wrapper

//   // Deposit some funds to L2 in order to be able to perform L2 transactions.
//   const depositAmount = ethers.utils.parseEther("0.001");
//   const depositHandle = await deployer.zkWallet.deposit({
//     to: deployer.zkWallet.address,
//     token: utils.ETH_ADDRESS,
//     amount: depositAmount,
//   });
//   // Wait until the deposit is processed on zkSync
//   await depositHandle.wait();

  // deploy EthCrossChainData
  if (config.EthCrossChainData === undefined) {
    console.log("\ndeploy EthCrossChainData ......");
    ccd = await deployer.deploy(CCD, []);
    config.EthCrossChainData = ccd.address;
    console.log("EthCrossChainData deployed to:", ccd.address);
    await writeConfig(config);
  }else{
    console.log("\nEthCrossChainData already deployed at", config.EthCrossChainData);
    const CCDabi = require("../artifacts-zk/contracts/core/cross_chain_manager/data/EthCrossChainData.sol/EthCrossChainData.json");
    ccd = new Contract(config.EthCrossChainData,CCDabi.abi,zkWallet._signerL2());
    //ccdd = new ContractFactory(CCDabi.abi,)
  }

  // deploy EthCrossChainManager
  if (config.EthCrossChainManager === undefined) {
    console.log("\ndeploy EthCrossChainManager ......");
    ccm = await deployer.deploy(CCM, [ccd.address, polyId_zk, [], []]);
    console.log("EthCrossChainManager deployed to:", ccm.address);
    config.EthCrossChainManager=ccm.address
    await writeConfig(config)
  }else{
    console.log("\nEthCrossChainManager already deployed at", config.EthCrossChainManager);
    const CCMabi = require("../artifacts-zk/contracts/core/cross_chain_manager/logic/EthCrossChainManager.sol/EthCrossChainManager.json");
    ccm = new Contract(config.EthCrossChainManager,CCMabi.abi,zkWallet._signerL2());
  }


  // deploy EthCrossChainManagerProxy
  if (config.EthCrossChainManagerProxy === undefined) {
    console.log("\ndeploy EthCrossChainManagerProxy ......");
    ccmp = await deployer.deploy(CCMP, [ccm.address]);
    console.log("EthCrossChainManagerProxy deployed to:", ccmp.address);
    config.EthCrossChainManagerProxy = ccmp.address
    await writeConfig(config)
  }else{
    console.log("\nEthCrossChainManagerProxy already deployed at", config.EthCrossChainManagerProxy)
    const CCMPabi = require("../artifacts-zk/contracts/core/cross_chain_manager/upgrade/EthCrossChainManagerProxy.sol/EthCrossChainManagerProxy.json")
    ccmp = new Contract(config.EthCrossChainManagerProxy,CCMPabi.abi,zkWallet._signerL2())
  }

  let ccdOwner = await ccd.owner()
  let ccmOwner = await ccm.owner();
  // transfer ownership
  if (ccdOwner == ccm.address) {
    console.log("eccd ownership already transferred");
  }else{
    console.log("\ntransfer eccd's ownership to ccm ......");
    let tx = await ccd.transferOwnership(ccm.address);
    await tx.wait();
    console.log("ownership transferred");
  }

  if (ccmOwner == ccmp.address) {
    console.log("ccm ownership already transferred");
  }else{
    console.log("\ntransfer ccm's ownership to ccmp ......");
    let tx = await ccm.transferOwnership(ccmp.address);
    await tx.wait();
    console.log("ownership transferred");
  }

  // init genesis keepers
  // const header = TODO
  // const pkbytes = TODO
  // console.log("\ninit ......");
  // tx = await ccm.initGenesisBlock(header,pkbytes,{
  //   customData: {
  //     feeToken: USDC_ADDRESS,
  //   },
  // });
  // await tx.wait();
  // console.log("init Done");

  // deploy LockProxy
  if (config.LockProxy === undefined) {
    console.log("\ndeploy LockProxy ......");
    lockproxy = await deployer.deploy(LockProxy, []);
    console.log("LockProxy deployed to:", lockproxy.address);
    config.LockProxy=lockproxy.address;
    await writeConfig(config);
  }else{
    console.log("\nLockProxy already deployed at", config.LockProxy)
    const LPabi=require("../artifacts-zk/contracts/core/lock_proxy/LockProxy.sol/LockProxy.json")
    lockproxy = new Contract(config.LockProxy,LPabi.abi,zkWallet._signerL2())
  }

  // setup LockProxy
  let alreadySetCCMP = await lockproxy.managerProxyContract()
  if (alreadySetCCMP == ccmp.address) {
    console.log("managerProxyContract already set");
  }else {
    console.log("\nsetup LockProxy ......");
    let tx = await lockproxy.setManagerProxy(ccmp.address);
    await tx.wait();
    console.log("setManagerProxy Done");
  }

  // add LockProxy to whitelist
  let fromContractWls = new Array;
  let contractMethodWls = new Array;
  let name = "LockProxy"
  let lockproxyAddr = lockproxy.address
  let method = ["0x756e6c6f636b"] // unlock
  console.log("\ncheck " + name + " WhiteList ......");
  let flag1 = await ccm.whiteListFromContract(lockproxyAddr)
  let flag2 = await ccm.whiteListContractMethodMap(lockproxyAddr, method[0])
  if (flag1 == true) {
      console.log(name + " already in fromContractWhiteList");
  } else {
      console.log(name + " will be add to fromContractWhiteList");
      fromContractWls.push(lockproxyAddr)
  }
  if (flag2 == true) {
      console.log(name + " already in contractMethodWhiteList");
  } else {
      console.log(name + " will be add to contractMethodWhiteList");
      let abiEncoder = new AbiCoder; 
      let abiData = abiEncoder.encode(['address','bytes[]'], [lockproxyAddr, method])
      contractMethodWls.push(abiData)
  }
  if (fromContractWls.length != 0) {
      console.log("\nsetFromContractWhiteList ......");
      let tx = await ccm.setFromContractWhiteList(fromContractWls);
      await tx.wait();
      console.log("setFromContractWhiteList done");
  }
  if (contractMethodWls.length != 0) {
      console.log("\nsetContractMethodWhiteList ......");
      let tx = await ccm.setContractMethodWhiteList(contractMethodWls);
      await tx.wait();
      console.log("setContractMethodWhiteList done");
  }

  // deploy WrapperV3
  if (config.WrapperV3 === undefined) {
    console.log("\ndeploy WrapperV3 ......");
    wrapper = await deployer.deploy(WrapperV3, []);
    console.log("WrapperV3 deployed to:", wrapper.address);
    config.WrapperV3=wrapper.address
    await writeConfig(config)
  }else{
    console.log("\nWrapperV3 already deployed at", config.WrapperV3)
    const wrpabi= require("../artifacts-zk/contracts/core/wrapper/zkWrapperV3.sol/WrapperV3.json")
    wrapper = new Contract(config.WrapperV3,wrpabi.abi,zkWallet._signerL2())
  }

  // addLockProxy
  let alreadyaddLockProxy= wrapper.isValidLockProxy(lockproxy.address)
  if (alreadyaddLockProxy){
    console.log("wrapperV3 lockProxy already set already");
  }else{
    console.log("\naddLockProxy......");
    let tx = await wrapper.addLockProxy(lockproxy.address);
    await tx.wait();
    console.log("addLockProxy Done");
  }
  // write config
  console.log("constract output:\n",config);
  await writeConfig(config)
  console.log("\nwrite config done\n");

  console.log("\nDone.\n");
  
}

async function readConfig(networkName) {
  let jsonData
  try {
    jsonData = fs.readFileSync(configPath)
  } catch(err) {
    if (err.code == 'ENOENT') {
      createEmptyConfig()
      return
    }else{
      console.error(err);
      process.exit(1);
    }
  }
  if (jsonData === undefined) {
    return
  }
  var json=JSON.parse(jsonData.toString())
  if (json.Networks === undefined) {
    return
  }
  for (let i=0; i<json.Networks.length; i++) {
    if (json.Networks[i].Name == networkName) {
      return json.Networks[i]
    }
  }
  // console.error("network do not exisit in config".red);
  // process.exit(1);
}
async function writeConfig(networkConfig) {
  if (networkConfig.Name === undefined) {
    console.error("invalid network config");
    process.exit(1);
  }
  let data=fs.readFileSync(configPath,(err,data)=>{
    let previous;
    if (err) {
      console.error(err);
      process.exit(1);
    } else {
      previous = data.toString();
    }
  });
  var json = JSON.parse(data.toString())
  var writeIndex = json.Networks.length
  for (let i=0; i<json.Networks.length; i++) {
    if (json.Networks[i].Name == networkConfig.Name) {
      writeIndex = i
      break
    }
  }
  json.Networks[writeIndex] = networkConfig
  var jsonConfig = JSON.stringify(json,null,"\t")
  try {
    fs.writeFileSync(configPath, jsonConfig);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

function createEmptyConfig() {
  var json = {Networks: []}
  var jsonConfig = JSON.stringify(json,null,"\t")
  try {
    fs.writeFileSync(configPath, jsonConfig);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
