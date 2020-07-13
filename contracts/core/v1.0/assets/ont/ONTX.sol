pragma solidity ^0.5.0;

import "./../../../../libs/token/ERC20/ERC20Detailed.sol";
import "./../../../../libs/GSN/Context.sol";
import "./../../../../libs/token/ERC20/ERC20.sol";

contract ONTX is Context, ERC20, ERC20Detailed {
    
    constructor (address proxyContractAddress) public ERC20Detailed("ONT Token", "ONTX", 0) {
        _mint(proxyContractAddress, 1000000000);
    }
}