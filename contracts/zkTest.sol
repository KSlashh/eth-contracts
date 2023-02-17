pragma solidity ^0.8.0;

import "./libs/utils/Utils.sol";
import "./libs/utils/Strings.sol";
import "./core/cross_chain_manager/libs/EthCrossChainUtils.sol";
import "./libs/common/ZeroCopySource.sol";
import "./libs/common/ZeroCopySink.sol";

contract Test {

    function msgValueTest() payable public {
        revert(string.concat("INFO: msg.value is: ",Strings.toHexString(msg.value)));
    }

    function testRipemd160(bytes memory input) public pure returns(bytes20) {
        return ripemd160(input);
    }

    function testSha256(bytes memory input) public pure returns(bytes32) {
        return sha256(input);
    }

    function testKeccak256(bytes memory input) public pure returns(bytes32) {
        return keccak256(input);
    }

    function testEcrecover(bytes32 hash, bytes memory sig, uint256 pos) public pure returns(address) {
        (uint8 v,bytes32 r,bytes32 s) = signatureSplit(sig, pos);
        return ecrecover(hash, v, r, s);
    }
    function signatureSplit(bytes memory signatures, uint256 pos) public pure returns (uint8 v, bytes32 r, bytes32 s) {
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            v := and(mload(add(signatures, add(signaturePos, 0x41))), 0xff)
        }
    }

    function bytesToAddress(bytes memory x) public pure returns(address) {
        return Utils.bytesToAddress(x);
    }

    function extCodeView(address _toContract) public returns(uint size, bytes32 hash, bool _isContract) {
        assembly {
            size := extcodesize(_toContract)
            hash := extcodehash(_toContract)
        }
        _isContract = Utils.isContract(_toContract);

        string memory tag = "false";
        if (isContract(_toContract)) {
            tag = "true";
        }
        require(isContract(_toContract), 
            string.concat("The passed in address: ",Strings.toHexString(_toContract)," is not a contract! tag: ",tag));

        click = !click;
        click = !click;
    }

    function extCodeView() public view returns(uint size, bytes32 hash, bool _isContract) {
        address _toContract = address(0x3243AB915767065466a048c1e43cB5C2d9CCc16B);
        assembly {
            size := extcodesize(_toContract)
            hash := extcodehash(_toContract)
        }
        _isContract = isContract(_toContract);

        string memory tag = "false";
        if (isContract(_toContract)) {
            tag = "true";
        }
        require(isContract(_toContract), 
            string.concat("The passed in address: ",Strings.toHexString(_toContract)," is not a contract! tag: ",tag));
    }

    bool public click;
    function doSwitch() public {
        click = !click;
    }

    function isContract(address account) internal view returns (bool) {
        if (!click) {
            return Utils.isContract(account);
        }
        // This method relies in extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        // According to EIP-1052, 0x0 is the value returned for not-yet created accounts
        // and 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is returned
        // for accounts without code, i.e. `keccak256('')`
        bytes32 codehash;
        bytes32 accountHash = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
        // solhint-disable-next-line no-inline-assembly
        assembly { codehash := extcodehash(account) }
        revert(string.concat("account: ", Strings.toHexString(account), " codehash: ",Strings.toHexString(uint(codehash))));
        return (codehash != 0x0 && codehash != accountHash);
    }

    function merkleProve(bytes memory _auditPath, bytes32 _root) public pure returns (bytes memory) {
        return ECCUtils.merkleProve(_auditPath, _root);
    }

    function deserializeMerkleValue(bytes memory _valueBs) public pure returns (ECCUtils.ToMerkleValue memory) {
        return ECCUtils.deserializeMerkleValue(_valueBs);
    }  

    function deserializeHeader(bytes memory _headerBs) public pure returns (ECCUtils.Header memory) {
        return ECCUtils.deserializeHeader(_headerBs);
    }
    

}