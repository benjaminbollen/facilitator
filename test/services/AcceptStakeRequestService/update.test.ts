// Copyright 2019 OpenST Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// ----------------------------------------------------------------------------

import 'mocha';

import BigNumber from 'bignumber.js';
import * as sinon from 'sinon';
import StakeRequest from '../../../src/models/StakeRequest';
import Repositories from '../../../src/repositories/Repositories';
import {
  Message,
  MessageAttributes,
  MessageDirection,
  MessageStatus,
  MessageType,
} from '../../../src/repositories/MessageRepository';
import AcceptStakeRequestService from '../../../src/services/AcceptStakeRequestService';
import assert from '../../test_utils/assert';

const Web3 = require('web3');

interface TestConfigInterface {
  web3: any;
  repos: Repositories;
  stakeRequestWithMessageHashB: StakeRequest;
  stakeRequestWithNullMessageHashC: StakeRequest;
  service: AcceptStakeRequestService;
}
let config: TestConfigInterface;

describe('StakeRequestRepository::save', (): void => {
  beforeEach(async (): Promise<void> => {
    const repos = await Repositories.create();
    const web3 = new Web3();
    const service = new AcceptStakeRequestService(repos, web3);
    config = {
      web3,
      repos,
      stakeRequestWithMessageHashB: new StakeRequest(
        'stakeRequestHashB',
        new BigNumber('11'),
        '0x0000000000000000000000000000000000000001',
        new BigNumber('12'),
        new BigNumber('13'),
        new BigNumber('14'),
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003',
        'messageHashB',
      ),
      stakeRequestWithNullMessageHashC: new StakeRequest(
        'stakeRequestHashC',
        new BigNumber('21'),
        '0x0000000000000000000000000000000000000011',
        new BigNumber('22'),
        new BigNumber('23'),
        new BigNumber('24'),
        '0x0000000000000000000000000000000000000012',
        '0x0000000000000000000000000000000000000013',
      ),
      service,
    };

    const messageAttributes: MessageAttributes = {
      messageHash: config.stakeRequestWithMessageHashB.messageHash as string,
      type: MessageType.Stake,
      gatewayAddress: '0x0000000000000000000000000000000000000001',
      sourceStatus: MessageStatus.Declared,
      targetStatus: MessageStatus.Undeclared,
      gasPrice: new BigNumber('1'),
      gasLimit: new BigNumber('1'),
      nonce: new BigNumber('1'),
      sender: '0x0000000000000000000000000000000000000002',
      direction: MessageDirection.OriginToAuxiliary,
      sourceDeclarationBlockHeight: new BigNumber('1'),
    };

    await config.repos.messageRepository.create(
      messageAttributes,
    );

    await config.repos.stakeRequestRepository.save(
      config.stakeRequestWithMessageHashB,
    );

    await config.repos.stakeRequestRepository.save(
      config.stakeRequestWithNullMessageHashC,
    );
  });

  it('Checks that repositories properly updated.', async (): Promise<void> => {
    const stakeRequests = [
      config.stakeRequestWithMessageHashB,
      config.stakeRequestWithNullMessageHashC,
    ];

    const fakeSecret = '0x1d5b16860e7306df9e2d3ee077d6f3e3c4a4b5b22d2ae6d5adfee6a2147f529c';
    const fakeHashLock = '0xa36e17d0a9b4240af1deff571017e108d2c1a40de02d84f419113b1e1f7ad40f';
    const fakeMessageHash = '0x15d2b8c03013fe1780d44c7c93b5d03422f88c8d4084568d190d7eb1a9907646';

    const generateFake = sinon.fake.returns({ secret: fakeSecret, hashLock: fakeHashLock });
    sinon.replace(
      AcceptStakeRequestService,
      'generateSecret',
      generateFake,
    );

    await config.service.update(stakeRequests);

    const stakeRequestC = await config.repos.stakeRequestRepository.get(
      config.stakeRequestWithNullMessageHashC.stakeRequestHash,
    ) as StakeRequest;

    assert.notStrictEqual(
      stakeRequestC,
      null,
      'Stake request exists in repository.',
    );

    assert.isOk(
      stakeRequestC.messageHash,
      'Stake request\'s hash is not null, as it has been accepted.',
    );

    const messageC = await config.repos.messageRepository.get(
      stakeRequestC.messageHash as string,
    ) as Message;

    assert.notStrictEqual(
      messageC,
      null,
      'Message exists in the repository.',
    );

    assert.strictEqual(
      messageC.type,
      MessageType.Stake,
    );

    assert.strictEqual(
      messageC.gatewayAddress,
      stakeRequestC.gateway,
    );

    assert.strictEqual(
      messageC.sourceStatus,
      MessageStatus.Undeclared,
    );

    assert.strictEqual(
      messageC.targetStatus,
      MessageStatus.Undeclared,
    );

    assert.strictEqual(
      messageC.gasPrice.comparedTo(stakeRequestC.gasPrice as BigNumber),
      0,
    );

    assert.strictEqual(
      messageC.gasLimit.comparedTo(stakeRequestC.gasLimit as BigNumber),
      0,
    );

    assert.strictEqual(
      messageC.nonce.comparedTo(stakeRequestC.nonce as BigNumber),
      0,
    );

    assert.strictEqual(
      messageC.sender,
      stakeRequestC.stakerProxy,
    );

    assert.strictEqual(
      messageC.direction,
      MessageDirection.OriginToAuxiliary,
    );

    assert.strictEqual(
      messageC.sourceDeclarationBlockHeight.comparedTo(0),
      0,
    );

    assert.strictEqual(
      messageC.secret,
      fakeSecret,
    );

    assert.strictEqual(
      messageC.hashLock,
      fakeHashLock,
    );

    // Here we check against pre-calculated message hash (using fake data).
    // This is a sanity check. It would fail if there is a semantic change
    // in hash calculation. This should not happen in general. However,
    // if it's intended, the message hash calculation in corresponding contract
    // should be updated also. This catch (sync between message hash calculations
    // in js and contract layer) is going to be taken care by integration test.
    assert.strictEqual(
      messageC.messageHash,
      fakeMessageHash,
    );
  });
});
