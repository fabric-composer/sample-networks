/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const path = require('path');

require('chai').should();

const NS = 'org.acme.sample';

describe('Sample', () => {

  // let adminConnection;
    let businessNetworkConnection;

    before(() => {
        const adminConnection = new AdminConnection();
        return adminConnection.createProfile('defaultProfile', {
            type : 'embedded'
        })
        .then(() => {
            return adminConnection.connect('defaultProfile', 'WebAppAdmin', 'DJY27pEnl16d');
        })
        .then(() => {
            return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        })
        .then((businessNetworkDefinition) => {
            return adminConnection.deploy(businessNetworkDefinition);
        })
        .then(() => {
            businessNetworkConnection = new BusinessNetworkConnection();
            return businessNetworkConnection.connect('defaultProfile', NS, 'WebAppAdmin', 'DJY27pEnl16d');
        });
    });

    describe('#sampleTransaction', () => {

        it('should be able to update asset value', () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the sample participant
            const dan = factory.newResource(NS, 'SampleParticipant', 'daniel.selman@uk.ibm.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

             // create the sample asset
            const sampleAsset = factory.newResource(NS, 'SampleAsset', 'ASSET_001');
            sampleAsset.value = 'my asset';
            sampleAsset.owner = factory.newRelationship(NS, 'SampleParticipant', dan.$identifier);

            const sampleTransaction = factory.newTransaction(NS, 'SampleTransaction');
            sampleTransaction.newValue = 'changed asset';
            sampleTransaction.asset = factory.newRelationship(NS, 'SampleAsset', sampleAsset.$identifier);

            // Get the asset registry.
            return businessNetworkConnection.getAssetRegistry(NS + '.SampleAsset')
            .then((assetRegistry) => {

                // Add the Marble to the asset registry.
                return assetRegistry.add(sampleAsset)
                .then(() => {
                    return businessNetworkConnection.getParticipantRegistry(NS + '.SampleParticipant');
                })
                .then((participantRegistry) => {
                    // add the participant
                    return participantRegistry.add(dan);
                })
                .then(() => {
                   // submit the transaction
                    return businessNetworkConnection.submitTransaction(sampleTransaction);
                })
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.SampleAsset');
                })
                .then((assetRegistry) => {
                    // get the listing
                    return assetRegistry.get(sampleAsset.$identifier);
                })
                .then((newAsset) => {
                     // the value should have change
                    newAsset.value.should.equal('changed asset');
                });
            });
        });
    });
});
