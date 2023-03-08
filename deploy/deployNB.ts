import { utils, Wallet, ContractFactory, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {

  // Initialize the wallet.
  const wallet = new Wallet("0x85268be23f45f17e9ec8691dc540b23a21d4c6cbe851a7576cb94b110c730197");

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);
  const ERC20PreMint = await deployer.loadArtifact("ERC20PreMint");

  const name = "Nobel Boss Coin"
  const symbol = "NB"
  const decimal = 6
  const initReceiver = "0x6Ac449ADE24174238DF325749bD5ea87B02BF7f6"
  const initSupply = 100000000000000

  // deploy NB
  console.log("\ndeploy NB ......");
  const nb = await deployer.deploy(ERC20PreMint, [name, symbol, decimal, initReceiver, initSupply]);
  console.log("NB deployed to:", nb.address);
}