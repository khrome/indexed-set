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
            item['name'] = (lcv<2)?'blah':Faker.Name.findName();
            item['email'] = Faker.Internet.email();
            item['city'] = Faker.Address.city();
            item['state'] = Faker.Address.usState();
            data.push(item);
        }
        data.push({
            '_id' : '27g7fgv8abc645'+Math.floor(Math.random()*100000)+'',
            name : 'something',
            email : Faker.Internet.email(),
            city : Faker.Address.city(),
            state : Faker.Address.usState()
        });
        data.push({
            '_id' : '27g7fgv8abc645'+Math.floor(Math.random()*100000)+'',
            name : Faker.Name.findName(),
            email : 'someone@blah.com',
            city : Faker.Address.city(),
            state : Faker.Address.usState()
        });
        data.push({
            '_id' : '27g7fgv8abc645'+Math.floor(Math.random()*100000)+'',
            name : 'something',
            email : 'someone@blah.com',
            city : Faker.Address.city(),
            state : Faker.Address.usState()
        });
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

    it('reduces two sets and correctly \'or\'s them', function(){
        var blahs = theSet.clone().with('name', '==', 'blah');
        var somethings = theSet.clone().with('name', '==', 'something');
        blahs.length.should.equal(2);
        somethings.length.should.equal(2);
        var both = blahs.or(somethings);
        both.length.should.equal(4);
    });

    it('reduces two sets and correctly \'xor\'s them', function(){
        var emails = theSet.clone().with('email', '==', 'someone@blah.com');
        var somethings = theSet.clone().with('name', '==', 'something');
        emails.length.should.equal(2);
        somethings.length.should.equal(2);
        var both = emails.xor(somethings);
        both.length.should.equal(2);
    });

    it('reduces two sets and correctly \'and\'s them', function(){
        var emails = theSet.clone().with('email', '==', 'someone@blah.com');
        var somethings = theSet.clone().with('name', '==', 'something');
        emails.length.should.equal(2);
        somethings.length.should.equal(2);
        var both = emails.and(somethings);
        both.length.should.equal(1);
    });

    it('reduces two sets and correctly \'not\'s them', function(){
        var emails = theSet.clone().with('email', '==', 'someone@blah.com');
        var somethings = theSet.clone().with('name', '==', 'something');
        emails.length.should.equal(2);
        somethings.length.should.equal(2);
        var both = emails.and(somethings);
        both.length.should.equal(1);
    });

    it('members update correctly', function(){
        var subset = theSet.clone().with('_id', '==', theSet.by.position[0]['_id']);
        subset.by.position[0]['city'] = 'TTTTT';
        var newset = theSet.clone().with('_id', '==', theSet.by.position[0]['_id']);
        newset.by.position[0]['city'].should.equal('TTTTT');
    });
});
