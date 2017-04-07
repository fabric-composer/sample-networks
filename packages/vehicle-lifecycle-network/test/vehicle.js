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
const BrowserFS = require('browserfs/dist/node/index');
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const BusinessNetworkDefinition = require('composer-common').BusinessNetworkDefinition;
const path = require('path');

require('chai').should();

const bfs_fs = BrowserFS.BFSRequire('fs');
const NS = 'org.acme.vehicle.lifecycle';
let factory;

describe('Vehicle Lifecycle Network', () => {

    let businessNetworkConnection;

    before(() => {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
        const adminConnection = new AdminConnection({ fs: bfs_fs });
        return adminConnection.createProfile('defaultProfile', {
            type: 'embedded'
        })
        .then(() => {
            return adminConnection.connect('defaultProfile', 'admin', 'Xurw3yU9zI0l');
        })
        .then(() => {
            return BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        })
        .then((businessNetworkDefinition) => {
            return adminConnection.deploy(businessNetworkDefinition);
        })
        .then(() => {
            businessNetworkConnection = new BusinessNetworkConnection({ fs: bfs_fs });
            return businessNetworkConnection.connect('defaultProfile', 'vehicle-lifecycle-network', 'admin', 'Xurw3yU9zI0l');
        })
        .then(() => {
            // submit the setup demo transaction
            // this will create some sample assets and participants
            factory = businessNetworkConnection.getBusinessNetwork().getFactory();
            const setupDemo = factory.newTransaction(NS, 'SetupDemo');
            return businessNetworkConnection.submitTransaction(setupDemo);
        });
    });

    describe('#manufacture vehicle', () => {

        it('should be able to manufacture a vehicle', () => {
            // submit the transaction
            const manufactureVehicle = factory.newTransaction(NS, 'ManufactureVehicle');
            manufactureVehicle.vin = 'ABC123';
            manufactureVehicle.manufacturer = factory.newRelationship(NS, 'Manufacturer', 'manufacturer@email.com');
            const vehicleDetails = factory.newConcept(NS, 'VehicleDetails');
            vehicleDetails.numberPlate = manufactureVehicle.vin;
            vehicleDetails.model = 'Mustang';
            vehicleDetails.make = 'Ford';
            vehicleDetails.colour = 'Red';
            vehicleDetails.co2Rating = 10.3;
            manufactureVehicle.vehicleDetails = vehicleDetails;

            return businessNetworkConnection.submitTransaction(manufactureVehicle)
                .then(() => {
                    return businessNetworkConnection.getAssetRegistry(NS + '.Vehicle');
                })
                .then((vehicleRegistry) => {
                    // check the state of the shipment
                    return vehicleRegistry.get('ABC123');
                })
                .then((vehicle) => {
                    vehicle.vehicleStatus.should.equal('CREATED');
                });
        });
    });
});
