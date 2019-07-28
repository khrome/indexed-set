var should = require("should");
var request = require("request");
var Indexed = require('./indexed-set').enableProxyWrapper();

describe('Indexed.Set', function(){
    var application;
    var running = false;
    var collection;
    var theSet;
    before(function(){
        var Faker = require('faker2');
        var data = [];
        for(var lcv=0; lcv < 4; lcv++){
            var item = {};
            item['_id'] = '27g7fgv8abc645'+Math.floor(Math.random()*100000)+'';
            item['name'] = Faker.Name.findName();
            item['email'] = Faker.Internet.email();
            item['city'] = Faker.Address.city();
            item['state'] = Faker.Address.usState();
            data.push(item);
        }
        collection = new Indexed.Collection(data);
        theSet = new Indexed.Set(collection);
    });

    it('generates test data', function(){
        theSet.length.should.not.equal(0);
    });

    it('clones a set', function(){
        var subset = theSet.clone();
        theSet.length.should.equal(subset.length);
        theSet.by.position[0]
        subset.forEach(function(item, index){
            theSet.by.position[index].state.should.equal(item.state);
        });
    });

    it('reduces a set and all members are correct', function(){
        var subset = theSet.clone().with('state', '==', theSet.by.position[0].state);
        subset.length.should.not.equal(theSet.length);
        var found = false;
        subset.forEach(function(item){
            found = found || theSet.by.position[0].state != item.state;
        });
        found.should.equal(false);
    });

    it('members update correctly', function(){
        var subset = theSet.clone().with('_id', '==', theSet.by.position[0]['_id']);
        subset.by.position[0]['city'] = 'TTTTT';
        var newset = theSet.clone().with('_id', '==', theSet.by.position[0]['_id']);
        newset.by.position[0]['city'].should.equal('TTTTT');
    });
});
