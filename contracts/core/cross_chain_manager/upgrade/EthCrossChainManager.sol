pragma solidity ^0.8.0;

import "../libs/upgradeability/AdminUpgradeabilityProxy.sol";

contract EthCrossChainManager is AdminUpgradeabilityProxy {
    constructor(address _logic, address _admin, bytes memory _data) AdminUpgradeabilityProxy(_logic, _admin, _data) payable {
    }
}

contract empty {}