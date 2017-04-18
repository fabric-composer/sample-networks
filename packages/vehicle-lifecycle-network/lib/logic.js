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

/**
 * Setup the demo
 * @param {org.acme.vehicle.lifecycle.SetupDemo} setupDemo - the SetupDemo transaction
 * @transaction
 */
function setupDemo(setupDemo) {
    console.log('setupDemo');

    let factory = getFactory();
    let NS = 'org.acme.vehicle.lifecycle';

    // create the participants
    let participants = [];
    let auctionHouse = factory.newResource(NS, 'AuctionHouse', 'auctionhouse');
    participants.push(auctionHouse);

    let dealership = factory.newResource(NS, 'Dealership', 'dealership');
    participants.push(dealership);

    let manufacturer = factory.newResource(NS, 'Manufacturer', 'manufacturer');
    participants.push(manufacturer);

    let scrapMerchant = factory.newResource(NS, 'ScrapMerchant', 'scrapmerchant');
    participants.push(scrapMerchant);

    let dan = factory.newResource(NS, 'PrivateOwner', 'dan');
    dan.vehicles = [];
    participants.push(dan);

    let simon = factory.newResource(NS, 'PrivateOwner', 'simon');
    participants.push(simon);

    let regulator = factory.newResource(NS, 'Regulator', 'regulator');
    participants.push(regulator);

    // create the vehicles
    let vehicles = [];
    for(let n=0; n < 10; n++) {
        let vehicle = factory.newResource(NS, 'Vehicle', 'VEH_' + n);
        let vehicleDetails = factory.newConcept(NS, 'VehicleDetails');
        vehicleDetails.model = 'Mustang';
        vehicleDetails.make = 'Ford';
        vehicleDetails.colour = 'Yellow';
        vehicleDetails.co2Rating = 10;
        vehicle.vehicleDetails = vehicleDetails;
        vehicle.vehicleStatus = 'CREATED';
        vehicle.manufacturer = factory.newRelationship(NS, 'Manufacturer', manufacturer.$identifier );
        vehicle.privateOwner = factory.newRelationship(NS, 'PrivateOwner', dan.$identifier );
        dan.vehicles.push(factory.newRelationship(NS, 'Vehicle', vehicle.$identifier ));
        vehicles.push(vehicle);
    }

    let promises = [];

    // save all the participants
    for(let n=0; n < participants.length; n++) {
        let participant = participants[n];
        //console.log('Saving ' + participant );
        promises.push(
            getParticipantRegistry(participant.getFullyQualifiedType())
                .then(function (registry) {
                    return registry.add(participant);
                })
        );
    }

    // save all the assets
    for(let n=0; n < vehicles.length; n++) {
        let asset = vehicles[n];
        //console.log('Saving ' + asset );
        promises.push(
            getAssetRegistry(asset.getFullyQualifiedType())
                .then(function (registry) {
                    return registry.add(asset);
                })
        );
    }

    return Promise.all(promises);
}

/**
 * Manufacture a vehicle
 * @param {org.acme.vehicle.lifecycle.ManufactureVehicle} manufactureVehicle - the ManufactureVehicle transaction
 * @transaction
 */
function manufactureVehicle(manufactureVehicle) {
    console.log('manufactureVehicle');

    let factory = getFactory();
    let NS = 'org.acme.vehicle.lifecycle';

    let vehicle = factory.newResource(NS, 'Vehicle', manufactureVehicle.vin);
    vehicle.vehicleDetails = manufactureVehicle.vehicleDetails;
    vehicle.vehicleStatus = 'CREATED';
    vehicle.manufacturer = manufactureVehicle.manufacturer;

    if(!manufactureVehicle.manufacturer.vehicles) {
        manufactureVehicle.manufacturer.vehicles = [];
    }

    // associate the vehicle with the manufacturer
    manufactureVehicle.manufacturer.vehicles.push(vehicle);

    // save the vehicle
    return getAssetRegistry(vehicle.getFullyQualifiedType())
        .then(function (registry) {
            return registry.add(vehicle);
        })
        .then(function () {
            return getParticipantRegistry(manufactureVehicle.manufacturer.getFullyQualifiedType());
        })
        .then(function (registry) {
            // save the manufacturer
            return registry.update(manufactureVehicle.manufacturer);
        });
}

/**
 * Authorise a vehicle for release to the market.
 * @param {org.acme.vehicle.lifecycle.Authorise} authorise - the Authorise transaction
 * @transaction
 */
function authorise(authorise) {
    console.log('authorise');

    if(authorise.vehicle.vehicleStatus !== 'CREATED') {
        throw new Error('Cannot authorise a vehicle if not in CREATED state.');
    }

    authorise.vehicle.vehicleStatus = 'AUTHORIZED';

    if(!authorise.regulator.vehicles) {
        authorise.regulator.vehicles = [];
    }

    // associate the vehicle with the regulator
    authorise.regulator.vehicles.push(authorise.vehicle);

    // save the vehicle
    return getAssetRegistry(authorise.vehicle.getFullyQualifiedType())
        .then(function (registry) {
            return registry.update(authorise.vehicle);
        })
        .then(function () {
            return getParticipantRegistry(authorise.regulator.getFullyQualifiedType());
        })
        .then(function (registry) {
            // save the regulator
            return registry.update(authorise.regulator);
        });
}

/**
 * A transfer from one private owner to another. Note that the vehicle must be in the AUTHORIZED state.
 * @param {org.acme.vehicle.lifecycle.PrivateTransfer} privateTransfer - the PrivateTransfer transaction
 * @transaction
 */
function privateTransfer(privateTransfer) {
    console.log('privateTransfer');

    if(privateTransfer.vehicle.vehicleStatus !== 'AUTHORIZED') {
        throw new Error('Cannot transfer a vehicle to private ownership if not in AUTHORIZED state.');
    }

    var oldOwner = privateTransfer.vehicle.privateOwner;
    var newOwner = privateTransfer.privateOwner

    if(!oldOwner) {
        throw new Error('Vehicle ' + privateTransfer.vehicle + ' has no prior owner')
    }

    // remove the vehicle from the previous owner
    var priorCount = oldOwner.vehicles.length;
    oldOwner.vehicles = removeVehicle(oldOwner.vehicles, privateTransfer.vehicle);
    if(oldOwner.vehicles.length !== priorCount-1) {
        throw new Error('Prior owner ' + oldOwner + ' did not have the vehicle ' + privateTransfer.vehicle + ' in its list of vehicles: ' + oldOwner.vehicles);
    }

    // add the vehicle to the new owner
    if(!newOwner.vehicles) {
        newOwner.vehicles = [];
    }

    newOwner.vehicles.push(privateTransfer.vehicle)

    // switch owners
    privateTransfer.vehicle.privateOwner = newOwner;

    // save the vehicle
    return getAssetRegistry(privateTransfer.vehicle.getFullyQualifiedType())
        .then(function (registry) {
            return registry.update(privateTransfer.vehicle);
        })
        .then(function () {
            return getParticipantRegistry(oldOwner.getFullyQualifiedType());
        })
        .then(function (registry) {
            // save the old owner
            return registry.update(oldOwner);
        })
        .then(function () {
            return getParticipantRegistry(newOwner.getFullyQualifiedType());
        })
        .then(function (registry) {
            // save the new owner
            return registry.update(newOwner);
        });
}

/**
 * Removes a vehicle from the array
 * @param {org.acme.vehicle.lifecycle.Vehicle[]} vehicles - the vehicle array to filter
 * @param {org.acme.vehicle.lifecycle.Vehicle} vehicleToRemove - the vehicle to be removed from the array
 * @return {org.acme.vehicle.lifecycle.Vehicle[]} the array with the vehicleToRemote filtered out
 */
function removeVehicle(vehicles, vehicleToRemove) {
    var resultVehicles = [];

    if(vehicles) {
        for( var n=0; n < vehicles.length; n++) {
            var v = vehicles[n];

            if(v.$identifier !== vehicleToRemove.$identifier) {
                resultVehicles.push(v);
            }
        }
    }

    return resultVehicles;
}