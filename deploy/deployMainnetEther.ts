import { utils, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  // Initialize the wallet.
  const wallet = new Wallet(TODO);
  const polyId_zk = TODO;

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);
  const CCD = await deployer.loadArtifact("EthCrossChainData");
  const CCM = await deployer.loadArtifact("EthCrossChainManager");
  const CCMP = await deployer.loadArtifact("EthCrossChainManagerProxy");
  const LockProxy = await deployer.loadArtifact("LockProxy");
  const WrapperV3 = await deployer.loadArtifact("WrapperV3");

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
  console.log("\ndeploy EthCrossChainData ......");
  const ccd = await deployer.deploy(CCD, []);
  console.log("EthCrossChainData deployed to:", ccd.address);

  // deploy EthCrossChainManager
  console.log("\ndeploy EthCrossChainManager ......");
  const ccm = await deployer.deploy(CCM, [ccd.address, polyId_zk, [], []]);
  console.log("EthCrossChainManager deployed to:", ccm.address);

  // deploy EthCrossChainManagerProxy
  console.log("\ndeploy EthCrossChainManagerProxy ......");
  const ccmp = await deployer.deploy(CCMP, [ccm.address]);
  console.log("EthCrossChainManagerProxy deployed to:", ccmp.address);

  // transfer ownership
  console.log("\ntransfer eccd's ownership to ccm ......");
  let tx = await ccd.transferOwnership(ccm.address);
  await tx.wait();
  console.log("ownership transferred");

  console.log("\ntransfer ccm's ownership to ccmp ......");
  tx = await ccm.transferOwnership(ccmp.address);
  await tx.wait();
  console.log("ownership transferred");

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
  console.log("\ndeploy LockProxy ......");
  const lockproxy = await deployer.deploy(LockProxy, []);
  console.log("LockProxy deployed to:", lockproxy.address);

  // setup LockProxy
  console.log("\nsetup LockProxy ......");
  tx = await lockproxy.setManagerProxy(ccmp.address);
  await tx.wait();
  console.log("setManagerProxy Done");

  // deploy WrapperV3
  console.log("\ndeploy WrapperV3 ......");
  const wrapper = await deployer.deploy(WrapperV3, []);
  console.log("WrapperV3 deployed to:", wrapper.address);

  // addLockProxy
  console.log("\naddLockProxy......");
  tx = await wrapper.addLockProxy(lockproxy.address);
  await tx.wait();
  console.log("addLockProxy Done");
  
}