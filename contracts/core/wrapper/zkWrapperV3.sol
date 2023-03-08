pragma solidity ^0.8.0;

import "../../libs/token/ERC20/SafeERC20.sol";
import "../../libs/token/ERC20/IERC20.sol";
import "../../libs/ownership/Ownable.sol";
import "../../libs/utils/ReentrancyGuard.sol";
import "../../libs/math/SafeMath.sol";
import "../../libs/lifecycle/Pausable.sol";

import "../lock_proxy/ILockProxy.sol";

contract WrapperV3 is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    uint public maxLockProxyIndex = 0;
    address public feeCollector;

    mapping(uint => address) public lockProxyIndexMap;

    function setFeeCollector(address collector) external onlyOwner {
        require(collector != address(0), "emtpy address");
        feeCollector = collector;
    }

    function resetLockProxy(uint index, address _lockProxy) external onlyOwner {
        require(_lockProxy != address(0));
        require(lockProxyIndexMap[index] != address(0), "no lockproxy exsist in given index");
        lockProxyIndexMap[index] = _lockProxy;
        require(ILockProxy(_lockProxy).managerProxyContract() != address(0), "not lockproxy");
    }

    function addLockProxy(address _lockProxy) external onlyOwner {
        require(_lockProxy != address(0));
        lockProxyIndexMap[maxLockProxyIndex++] = _lockProxy;
        require(ILockProxy(_lockProxy).managerProxyContract() != address(0), "not lockproxy");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function extractFee(address token) external {
        require(msg.sender == feeCollector, "!feeCollector");
        if (token == address(0)) {
            transferEtherFromContract(feeCollector, address(this).balance);
        } else {
            IERC20(token).safeTransfer(feeCollector, IERC20(token).balanceOf(address(this)));
        }
    }

    function rescueFund(address tokenAddress) public onlyOwner {
        if (tokenAddress == address(0)) {
            transferEtherFromContract(msg.sender, address(this).balance);
        } else {
            IERC20(tokenAddress).safeTransfer(msg.sender, IERC20(tokenAddress).balanceOf(address(this)));
        }
    }
    
    function lock(address fromAsset, uint64 toChainId, bytes memory toAddress, uint amount, uint fee, uint id) public payable nonReentrant whenNotPaused {
        
        require(toAddress.length !=0, "empty toAddress");
        address addr;
        assembly { addr := mload(add(toAddress,0x14)) }
        require(addr != address(0),"zero toAddress");
        
        address lockProxy = _getSupportLockProxy(fromAsset, toChainId);

        if (fromAsset == address(0)) {
            require(msg.value == amount, "insufficient ether");
            require(amount > fee, "amount less than fee");
            amount = amount.sub(fee);
            require(ILockProxy(lockProxy).lock{value: amount}(fromAsset, toChainId, toAddress, amount), "lock ether fail");
        } else {
            IERC20(fromAsset).safeTransferFrom(msg.sender, address(this), amount);
            require(msg.value >= fee, "insufficient ether");
            IERC20(fromAsset).safeApprove(lockProxy, 0);
            IERC20(fromAsset).safeApprove(lockProxy, amount);
            require(ILockProxy(lockProxy).lock(fromAsset, toChainId, toAddress, amount), "lock erc20 fail");
        }

        emit PolyWrapperLock(fromAsset, msg.sender, toChainId, toAddress, amount, fee, id);
    }
    
    function specifiedLock(address fromAsset, uint64 toChainId, bytes memory toAddress, uint amount, uint fee, uint id, address lockProxy) external payable nonReentrant whenNotPaused {
        
        require(toAddress.length !=0, "empty toAddress");
        address addr;
        assembly { addr := mload(add(toAddress,0x14)) }
        require(addr != address(0),"zero toAddress");
        
        if (fromAsset == address(0)) {
            require(msg.value == amount, "insufficient ether");
            require(amount > fee, "amount less than fee");
            amount = amount.sub(fee);
            require(ILockProxy(lockProxy).lock{value: amount}(fromAsset, toChainId, toAddress, amount), "lock ether fail");
        } else {
            IERC20(fromAsset).safeTransferFrom(msg.sender, address(this), amount);
            require(msg.value >= fee, "insufficient ether");
            IERC20(fromAsset).safeApprove(lockProxy, 0);
            IERC20(fromAsset).safeApprove(lockProxy, amount);
            require(ILockProxy(lockProxy).lock(fromAsset, toChainId, toAddress, amount), "lock erc20 fail");
        }

        emit PolyWrapperLock(fromAsset, msg.sender, toChainId, toAddress, amount, fee, id);
    }

    function isValidLockProxy(address lockProxy) public view returns(bool) {
        for (uint i=0;i<maxLockProxyIndex;i++) {
            if (lockProxy == lockProxyIndexMap[i]) {
                return true;
            }
        }
        return false;
    }

    function _getSupportLockProxy(address fromAsset, uint64 toChainId) internal view returns(address) {
        for (uint i=0;i<maxLockProxyIndex;i++) {
            address lockProxy = lockProxyIndexMap[i];
            if (ILockProxy(lockProxy).assetHashMap(fromAsset, toChainId).length != 0) {
                return lockProxy;
            }
        }
        revert("No LockProxy Support this cross txn");
    } 

    function getBalanceBatch(address[] memory assets, address richGuy) public view returns(uint[] memory) {
        uint[] memory res = new uint[](assets.length);
        for (uint i=0;i<assets.length;i++) {
            if (assets[i] == address(0)) {
                res[i] = richGuy.balance;
            } else {
                res[i] = IERC20(assets[i]).balanceOf(richGuy);
            }
        }
        return res;
    }

    function transferEtherFromContract(address to, uint amount) internal {
        (bool success,) = to.call{value: amount}("");
        require(success, "transfer ether from contract failed");
    }

    event PolyWrapperLock(address indexed fromAsset, address indexed sender, uint64 toChainId, bytes toAddress, uint net, uint fee, uint id);

}