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
  ProxyAdmin: undefined,
  CallerFactory: undefined,
  EthCrossChainManager: undefined,
  EthCrossChainManagerImplementation: undefined,
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
  const ProxyAdmin = await deployer.loadArtifact("ProxyAdmin");
  const EthCrossChainData = await deployer.loadArtifact("EthCrossChainData");
  const CallerFactory = await deployer.loadArtifact("CallerFactoryWithAdmin");
  let EthCrossChainManagerImplementation = await deployer.loadArtifact("EthCrossChainManagerImplementation");
  const EthCrossChainManager = await deployer.loadArtifact("EthCrossChainManager");
  const LockProxy = await deployer.loadArtifact("LockProxy");
  const WrapperV3 = await deployer.loadArtifact("WrapperV3");
  let proxyAdmin
  let ccd
  let ccmi
  let ccm
  let cf
  let lockproxy
  let wrapper

  // deploy LockProxy
  if (config.LockProxy === undefined) {
    console.log("\ndeploy LockProxy ......");
    lockproxy = await deployer.deploy(LockProxy, []);
    console.log("LockProxy deployed to:", lockproxy.address);
    config.LockProxy=lockproxy.address;
    await writeConfig(config);
  }else{
    console.log("\nLockProxy already deployed at", config.LockProxy)
    const LockProxyFactory = new ContractFactory(LockProxy.abi, LockProxy.bytecode, zkWallet);
    lockproxy = await LockProxyFactory.attach(config.LockProxy)
  }

  // deploy EthCrossChainData
  if (config.EthCrossChainData === undefined) {
    console.log("\ndeploy EthCrossChainData ......");
    ccd = await deployer.deploy(EthCrossChainData, []);
    config.EthCrossChainData = ccd.address;
    console.log("EthCrossChainData deployed to:", ccd.address);
    await writeConfig(config);
  }else{
    console.log("\nEthCrossChainData already deployed at", config.EthCrossChainData);
    const EthCrossChainDataFactory = new ContractFactory(EthCrossChainData.abi, EthCrossChainData.bytecode, zkWallet);
    ccd = await EthCrossChainDataFactory.attach(config.EthCrossChainData)
  }
    
  // deploy CallerFactory
  if (config.CallerFactory === undefined) {
      // deploy CallerFactory
      console.log("\ndeploy CallerFactory ......");
      cf = await deployer.deploy(CallerFactory, [[lockproxy.address]]);
      await cf.deployed();
      console.log("CallerFactory deployed to:", cf.address);
      config.CallerFactory = cf.address
      writeConfig(config)
  } else {
      console.log("\nCallerFactory already deployed at", config.CallerFactory)
      const CallerFactoryFactory = new ContractFactory(CallerFactory.abi, CallerFactory.bytecode, zkWallet);
      cf = await CallerFactoryFactory.attach(config.CallerFactory)
  }
    
  // deploy EthCrossChainManagerImplementation
  if (config.EthCrossChainManagerImplementation === undefined) {
      // update Const.sol
      console.log("\nupdate Const.sol ......");
      await updateConst(polyId_zk, ccd.address, cf.address);
      console.log("Const.sol updated");
      await hre.run('compile');

      // deploy EthCrossChainManagerImplementation
      console.log("\ndeploy EthCrossChainManagerImplementation ......");
      EthCrossChainManagerImplementation = await deployer.loadArtifact("EthCrossChainManagerImplementation");
      ccmi = await deployer.deploy(EthCrossChainManagerImplementation, []);
      await ccmi.deployed();
      console.log("EthCrossChainManagerImplementation deployed to:", ccmi.address);
      config.EthCrossChainManagerImplementation = ccmi.address
      writeConfig(config)
  } else {
      console.log("\nEthCrossChainManagerImplementation already deployed at", config.EthCrossChainManagerImplementation)
      const EthCrossChainManagerImplementationFactory = new ContractFactory(EthCrossChainManagerImplementation.abi, EthCrossChainManagerImplementation.bytecode, zkWallet);
      ccmi = await EthCrossChainManagerImplementationFactory.attach(config.EthCrossChainManagerImplementation)
  }

  // deploy EthCrossChainManager
  if (config.EthCrossChainManager === undefined) {
      // deploy EthCrossChainManager
      console.log("\ndeploy EthCrossChainManager ......");
      ccm = await deployer.deploy(EthCrossChainManager, [ccmi.address, wallet.address ,'0x']);
      await ccm.deployed();
      console.log("EthCrossChainManager deployed to:", ccm.address);
      config.EthCrossChainManager = ccm.address
      writeConfig(config)
  } else {
      console.log("\nEthCrossChainManager already deployed at", config.EthCrossChainManager)
      const EthCrossChainManagerFactory = new ContractFactory(EthCrossChainManager.abi, EthCrossChainManager.bytecode, zkWallet);
      ccm = await EthCrossChainManagerFactory.attach(config.EthCrossChainManager)
  }

  let ccdOwner = await ccd.owner()
  // transfer ownership
  if (ccdOwner == ccm.address) {
    console.log("eccd ownership already transferred");
  }else{
    console.log("\ntransfer eccd's ownership to ccm ......");
    let tx = await ccd.transferOwnership(ccm.address);
    await tx.wait();
    console.log("ownership transferred");
  }

  // setup LockProxy
  let alreadySetCCMP = await lockproxy.managerProxyContract()
  if (alreadySetCCMP == ccm.address) {
    console.log("managerProxyContract already set");
  }else {
    console.log("\nsetup LockProxy ......");
    let tx = await lockproxy.setManagerProxy(ccm.address);
    await tx.wait();
    console.log("setManagerProxy Done");
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
    const WrapperV3Factory = new ContractFactory(WrapperV3.abi, WrapperV3.bytecode, zkWallet);
    wrapper = await WrapperV3Factory.attach(config.WrapperV3)
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

async function updateConst(polyChainId, eccd, callerFactory) {
  
    fs.writeFileSync('./contracts/core/cross_chain_manager/logic/Const.sol', 
    'pragma solidity ^0.8.0;\n'+
    'contract Const {\n'+
    '    bytes constant ZionCrossChainManagerAddress = hex"0000000000000000000000000000000000001003"; \n'+
    // '    bytes constant ZionCrossChainManagerAddress = hex"5747C05FF236F8d18BB21Bc02ecc389deF853cae"; \n'+
    '    \n'+
    '    address constant EthCrossChainDataAddress = '+eccd+'; \n'+
    '    address constant EthCrossChainCallerFactoryAddress = '+callerFactory+'; \n'+
    '    uint constant chainId = '+polyChainId+'; \n}', 
    function(err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    }); 
}
