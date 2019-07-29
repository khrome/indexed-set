(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['sift'], function(sift){
            factory(sift, {
                //todo: mock vm to be browser compatible
            });
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('sift'), require('vm'));
    } else {
        root.Indexed = factory(root.Sift, root.VM);
    }
}(this, function (sift, vm) {
    var array = {};
    array.erase = function(arr, field){
        var index;
        while((arr.indexOf(field)) != -1){ //get 'em all
            arr.splice(index, 1); //delete the one we found
        }
    };
    var IndexedSet = {};
    var SetForwardingHandler;
    IndexedSet.enableProxyWrapper = function(){
        //todo: allow proxies in the browser, too
        if(!global.Proxy){
            global.Proxy = require('node-proxy');
        }
        //var Proxy = require('node-proxy');
        // Proxies allow us to piggyback on javascript's array syntax
        SetForwardingHandler = function(obj) {
            this.target = obj;
        }
        SetForwardingHandler.prototype = {
            has: function(name){ return name in this.target; },
            get: function(rcvr, name){
                var ob = this;
                if(name === 'by'){
                    var accessors = {
                        position : new Proxy({}, {
                            get :function(target, name){
                                return ob.target.getByPosition(parseInt(name));
                            }
                        })
                    }
                    accessors.pos = accessors.position;
                    return accessors;
                }
                if( ((name || name === 0) && typeof name  == 'number') ){  //isNum?
                    return this.target.getByPosition(name);
                }
                if(typeof name === 'string' && name.match(/^[A-Fa-f0-9]*$/)){ //isHex?
                    return this.target.getById(name);
                }
                return this.target[name];
            },
            set: function(rcvr, name, val){
                if( ((name || name === 0) && typeof name  == 'number') ){  //isNum?
                    if(typeof value  == 'string'){
                        return this.target.setByPositionFromString(name, val);
                    }else{
                        return this.target.setByPositionFromObject(name, val);
                    }
                }
                if(typeof name === 'string' && name.match(/^[A-Fa-f0-9]*$/)){ //isHex?
                    if(typeof value  == 'string'){
                        return this.target.setByIdFromString(name, val);
                    }else{
                        return this.target.setByIdFromObject(name, val);
                    }
                }
                if(name == 'length') return this.ordering.length;
                this.target[name] = val;
                return true;
            },
            'delete': function(name){ return delete this.target[name]; },
            enumerate: function(){
            var res = [];
            for(var key in this.target.ordering) res.push(key);
                return res;
            },
            iterate: function() {
                var props = this.enumerate(), i = 0;
                return {
                    next: function() {
                        if (i === props.length) throw StopIteration;
                        return props[i++];
                    }
                };
            },
            keys: function() { return Object.keys(this.target); },
        };
        SetForwardingHandler.wrap = function(obj) {
            return new Proxy(Object.getPrototypeOf(obj), new SetForwardingHandler(obj));
        };
        IndexedSet.proxied = true;
        return IndexedSet;
    };
    function recursiveHeirarchy(hierarchy, fields, scope, stack, result, stringsOnly){
        if(!stack) stack = [];
        if(!result) result = {};
        var field = hierarchy.shift();
        var possibleValues = scope.distinct(field, stringsOnly);
        array.erase(fields, field);
        if(!result[field]) result[field] = {};
        if(stringsOnly){
            fields.forEach(function(field, index){
                if(typeof scope[0][field] != 'string') delete fields[index];
            });
        }
        possibleValues.forEach(function(value){
            if(!result[field][value]) result[field][value] = {};
            stack.push(scope);
            scope = scope.clone();
            scope.with(field, value);
            result[field][value]['_'] = {};
            var distinct = scope.distinct();
            fields.forEach(function(returnField){
                result[field][value]['_'][returnField] = distinct[returnField];
            });
            if(hierarchy.length > 0) recursiveHeirarchy(hierarchy.slice(0), fields.slice(0), scope, stack, result[field][value], stringsOnly);
            scope = stack.pop();
        });
        return result;
    }
    IndexedSet.Set = function(parent, options){
        if(parent && parent.index) this.index = parent.index;
        else this.index = {};
        if(parent && parent.ordering) this.ordering = parent.ordering.slice(0);
        else this.ordering = [];
        this.parent = parent;
        this.primaryKey = parent?parent.primaryKey:'_id';
        this.filters = [];
        this.buffer = false;
        var rootCollection = this.parent;
        this.root = rootCollection;
        while(rootCollection.parent) rootCollection = rootCollection.parent;
        // 'data' can flush a selection (assuming it's not asynchronously connected)
        var ob = this;
        Object.defineProperty(this, 'data', {
            get : function(){
                if(!ob.buffer){
                    ob.buffer = [];
                    ob.ordering.forEach(function(id){
                        ob.buffer.push(ob.root.lookup(id));
                    });
                }
                return this.buffer;
            },
            set : function(value){
                throw('The data preperty may not be set.')
            }
        });
        Object.defineProperty(this, 'length', {
            get : function(){
                return ob.ordering.length;
            },
            set : function(value){
                throw('Cannot set length property of a Set');
            }
        });

        if(IndexedSet.proxied) return SetForwardingHandler.wrap(this);
        else return this;
    };
    IndexedSet.arrayContains = function(array, item){
        /*for(index in array){
            if(array[index] === item) return true;
        }*/
        //return false;
        return array.indexOf(item) !== -1;
    };
    var escapeString = function(field){
        return field.replace('\\', '\\\\').replace('\'', '\\\'');
    };
    IndexedSet.Set.constructorOf = function(object){
        return !!(object.index && object.ordering && object.features);
    }
    IndexedSet.Set.prototype = {
        push : function(value){
            this.buffer = false;
            if(typeof value === 'string'){
                if(!this.root.lookup(value)) throw('object has no '+this.primaryKey+'(\''+value+'\')');
                this.ordering.push(value);
            }else{
                if(!value[this.primaryKey]) throw('object has no '+this.primaryKey);
                else{
                    if(!this.root.lookup(value[this.primaryKey])) this.root.index[value[this.primaryKey]] = value;
                    this.ordering.push(value[this.primaryKey]);
                }
            }
        },
        pop : function(){
            this.buffer = false;
            var id = this.ordering.pop();
            return this.root.lookup(id);
        },
        shift : function(){
            this.buffer = false;
            var id = this.ordering.shift();
            return this.root.lookup(id);
        },
        pause : function(){
            this.paused = true;
        },
        slice : function(start, stop){
            var ob = this.clone();
            ob.ordering = ob.ordering.slice(start, stop);
            return ob;
        },
        resume : function(){
            delete this.paused;
            if(this.blockedFilter){
                this._filterData();
                delete this.blockedFilter;
            }
        },
        _filterData : function(){
            var func = this.filterFunction(this.sandboxed);
            var results = [];
            var ob = this;
            var cxt;
            try{
                this.forEach(function(item, id){
                    cxt = {item:item,sift:(sift.default || sift), console:console};
                    var cond = ob.sandboxed?func.runInNewContext(cxt):func.apply(item);
                    if(cond) results.push(item[ob.primaryKey]);
                });
                this.ordering = results;
            }catch(ex){
                console.log('EEEERRRR', ex.stack);
            }
        },
        forEach : function(func){
            var ob = this;
            this.ordering.forEach(function(fieldName, index){
                func(ob.root.lookup(fieldName), index, fieldName);
            });
        },
        distinct : function(field){ //distinct(field) distinct() [object], or distinct(true) [object, strings only]
            var stringsMode = false;
            if(field === true){
                field = false;
                stringsMode = true;
            }
            var values = {};
            var fields = [];
            this.ordering.forEach(function(id, index){
                if(field){
                    if(!values['*']) values['*'] = [];
                    if(values['*'].indexOf(this[id][field]) === -1) values['*'].push(this[id][field]);
                }else{
                    var keys = Object.keys(this[id]);
                    keys.forEach(function(key){
                        var val = this[id][key];
                        if(fields.indexOf(key) === -1) fields.push(key);
                        if(!values[key]) values[key] = [];
                        if(values[key].indexOf(val) === -1 && ( (!stringsMode) || typeOf(val) == 'string') ) values[key].push(val);
                    }.bind(this));
                }
            }.bind(this));
            if(field) return values['*'];
            else return values;
        },
        byGroup : function(fieldName){
            var results = {};
            var segment;
            try{
                this.forEach(function(item){
                    segment = item[fieldName];
                    if(!results[segment]) results[segment] = new IndexedSet.Set(this.parent);
                    results[segment].filters = item.filters;
                    results[segment].push(item);
                }.bind(this));
            }catch(ex){
                console.log('Error!', ex);
            }
            return results;
        },
        clone : function(){
            var ob = new IndexedSet.Set(this.parent);
            ob.index = this.index;
            if(this.filters) ob.filters = this.filters.slice(0);
            else ob.filters = [];
            ob.ordering = this.ordering.slice(0);
            this.primaryKey = this.primaryKey;
            return ob;
        },
        //todo: both 'filter' and 'with' need some kind of callback or ready queue
        filter : function(fn, doFilter){
            if(!fn && !doFilter){
                this._filterData();
                return;
            }
            this.filters.push(fn);
            if(doFilter !== false && !this.paused){
                this._filterData(); //todo: apply *only* the current filter
            }else if(this.paused) this.blockedFilter = true;
            return this;
        },
        sift : function(document, callback){
            var filter = new Function('return sift('+JSON.stringify(document)+')(this)');
            this.sandboxed = true; //scoped fns cannot cross message boundaries(domains, machines, processes, etc.)
            this.filter(filter, true);
            if(callback) callback();
        },
        'with' : function(field, comparison, value, callback){
            if(comparison == '=') comparison = '=='; //lulz
            if(comparison && !value){
                value = comparison;
                comparison = '==='
            }
            var fn;
            try{
                //todo: fix the ugliness
                var body;
                switch(typeof value){
                    case 'string':
                        body = 'return this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'] '+comparison+' \''+value.replace('\\', '\\\\').replace('\'', '\\\'')+'\';'
                        //fn = new Function(body);
                        break;
                    case 'array':
                        if(value.length == 0) throw('no fields error!');
                        body = 'return this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'] '+comparison+' \''+value.join(' || \'+this.\'+field+\' \'+comparison+\' \\\'')+'\';'; //todo: array_map escaping
                        break;
                    case 'undefined':
                        body = 'return !!this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'];';
                        break;
                    default : body = 'return this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'] '+comparison+' '+value+';';
                }
                //fn = new Function(body);
                eval('fn = function(){ '+body+' }');
            }catch(ex){
                    console.log('ERROR IN GENERATED SELECTOR', body);
                    console.log('?', field, comparison, value);
                    throw ex;
            }
            var result = this.filter(fn, true);
            delete this.buffer;
            if(callback) callback();
            return result;
        },
        indexOf : function(target){
            var found;
            var type = typeof target;
            var ob = this;
            this.ordering.forEach(function(item, index){
                if(found !== undefined) return;
                switch(type){
                    case 'string':
                        if(item == target) found = index;
                        break;
                    default :
                        if(item == target[ob.primaryKey]) found = index;

                }
            });
            return found===undefined?-1:found;
        },
        toString : function(){
            return JSON.stringify(this.toArray(), undefined, '    ');
        },
        toArray : function(){
            var results = [];
            this.forEach(function(item, index, pos){
                results.push(item);
            }.bind(this));
            return results;
        },
        dump : function(){
            console.log('[FILTERS]');
            console.log(this.filters.map(function(fn){ return fn.toString() }).join("\n\n"));
            console.log('[DATA]');
            console.log(this.toArray());
        },
        and : function(set){
            if(set.root === this.root){
                var cl = this.root.clone();
                var body = 'var s = ('+set.filterFunction()+').apply(this); ';
                body += 'var t = ('+this.filterFunction()+').apply(this); ';
                body += 'return t && s';
                var fn = new Function(body);
                return cl.filter(fn, true);
            }
            throw new Error('joins not yet supported');
        },
        or : function(set){
            if(set.root === this.root){
                var cl = this.root.clone();
                var body = 'var s = ('+set.filterFunction()+').apply(this); ';
                body += 'var t = ('+this.filterFunction()+').apply(this); ';
                body += 'return t || s';
                var fn = new Function(body);
                return cl.filter(fn, true);
            }
            throw new Error('joins not yet supported');
        },
        xor : function(set){
            if(set.root === this.root){
                var cl = this.root.clone();
                var body = 'var s = ('+set.filterFunction()+').apply(this); ';
                body += 'var t = ('+this.filterFunction()+').apply(this); ';
                body += 'return (t || s) && !(t && s)';
                var fn = new Function(body);
                return cl.filter(fn, true);
            }
            throw new Error('joins not yet supported');
        },
        not : function(set){
            if(set.root === this.root){
                var cl = this.root.clone();
                var body = 'var s = ('+set.filterFunction()+').apply(this); ';
                body += 'var t = ('+this.filterFunction()+').apply(this); ';
                body += 'return t && !s';
                var fn = new Function(body);
                return cl.filter(fn, true);
            }
            throw new Error('joins not yet supported');
        },
        removeFilter : function(filter, callback){
            this.buffer = false;
            this.filters.erase(filter);
            //this.fireEvent('change');
        },
        filterFunction : function(returnScript, invert){
            var filters = [true];
            var nativ = false;
            //var IndexedSet = Indexed;
            this.filters.forEach(function(filter){
                filters.push('('+filter.toString()+').apply(this)');
            });
            if(returnScript){
                var script = new vm.Script('(function(){return '+(invert?'!':'')+'('+filters.join(' && ')+');}).apply(item)');
                return script;
            }else{
                var fun = new Function('return '+(invert?'!':'')+'('+filters.join(' && ')+');');
                return fun;
            }
        },
        getByPosition : function(position){
            if(!this.ordering[position]) return undefined;
            return this.root.lookup(this.ordering[position]);
        },
        getById : function(id){
            if(!id in this.ordering) return undefined;
            return this.root.lookup(id);
        },
        setByIdFromString : function(id, value){
            if(id !== value) throw('id value mismatch('+id+' != '+value+')');
            //if(!this.index[value]) throw('this '+this.primaryKey+'('+value+') not found!');
            if(this.indexOf(value) === -1){
                this.push(value);
            }// else the set already contains this value
        },
        setByPositionFromString : function(position, value){
            var theObject = this.root.lookup(value);
            if(!theObject) throw('this '+this.primaryKey+'('+value+') not found!');
            this.ordering[position] = value;
        },
        setByIdFromObject : function(id, value){
            if(id !== value[this.primaryKey]) throw('id value mismatch('+id+' != '+value[this.primaryKey]+')');
            if(this.root){
                var valueInCollection = this.root.lookup(id);
                if(!valueInCollection){
                    this.root.push(value);
                }else{
                    Object.keys(value).forEach(function(fieldName){
                        valueInCollection[fieldName] = value[fieldName];
                    });
                }
                var inSet = this.ordering.indexOf(id) !== -1;
                if(!inSet) this.ordering.push(value[this.primaryKey]);
            }

        },
        setByPositionFromObject : function(position, value){
            //if(!this.index[value[this.primaryKey]]) this.index[value[this.primaryKey]] = value;
            if(this.root){
                var valueInCollection = this.root.lookup(value[this.primaryKey]);
                if(!valueInCollection){
                    this.root.push(value);
                }else{
                    Object.keys(value).forEach(function(fieldName){
                        valueInCollection[fieldName] = value[fieldName];
                    });
                }
                var valueAtPosition = this.ordering[value[this.primaryKey]];
                if(!valueAtPosition){
                    this.ordering.push(value);
                }else{
                    this.ordering[position] = value[this.primaryKey];
                }
            }
        },
        //todo: thread me
        hierarchy : function(hierarchies, fields, discriminants, callback){
            if( (!callback) && typeof discriminants == 'function'){
                callback = discriminants;
                discriminants = undefined;
            }
            if( (!callback) && (!discriminants) && typeof fields == 'function'){
                callback = fields;
                fields = undefined;
            }
            try{
                var progenitor = this.clone();
                if(discriminants) discriminants.forEach(function(discriminant){
                    progenitor.with(discriminant.field, discriminant.operator, discriminant.value);
                });
                if(!fields) fields = Object.keys(this[0]);
                var result = {};
                hierarchies.forEach(function(hierarchy){
                    var fieldsCopy = fields.slice(0);
                    recursiveHeirarchy(hierarchy, fieldsCopy, progenitor, [], result, true);
                });
            }catch(ex){
                console.log('ERROR', ex, ex.stack);
            }
            if(callback) callback(result);
            return result;
        },
        aggregate : function(field, aggregator){
            var result;
            if(!aggregator) aggregator = function(a, b){ return a + b; }
            this.forEach(function(item){
                var value = item[field]
                if(typeof value == 'string'){
                    value = value.replace('\t', '').replace(' ', '').replace(',', '');
                    value = parseFloat(value);
                    value = value || 0.0;
                }
                result = aggregator(result || 0.0, value);
            });
            return result;
        }
    };
    IndexedSet.Collection = function(options, key){
        this.primaryKey = options.primaryKey || key || '_id';
        //this.primaryKey = '_id';
        if(typeof options === 'string') options = {name:options};
        if(Array.isArray(options)) options = {index:options};
        this.index = {};
        var ob = this;
        if(options.index){
            Object.keys(options.index).forEach(function(key){
                ob.index[options.index[key][ob.primaryKey]] = options.index[key];
            });
        }
        this.events = {};
        this.options = options;
        if(options && options.datasource){
            this.attachDatasource(options.datasource);
            this.load(options.onLoad.bind(this));
        }
        Object.defineProperty(this, 'ordering', {
            get : function(){
                var results = [];
                for(var id in this.index) results.push(id); //todo: honor segment
                return results;
            }.bind(this),
            set : function(value){
                throw('Collections do not support manual alterations of \'ordering\'!')
            }.bind(this)
        });
        //series code is currently naive and inefficient
        this.setSeries = function(fieldname, start, stop){
            //todo: implement
            this.raw = this.index;
            this.series = this.groupBy(fieldname);
        };
        this.autoRange = function(fieldname){
            var options = this.index.distinct(fieldname);
            var min = Number.MAX_VALUE;
            var max = Number.MIN_VALUE;
            options.each(function(value){
                if(min > value) min = value;
                if(max < value) max = value;
            });
            this.setSeriesRange(min, max);
        };
        this.setSeriesRange = function(start, stop){
            var current = new IndexedSet.Set(this);
            this.series.each(function(set, index){
                if(index > start && index > stop) current = current.and(set);
            });
            this.index = current;
            this.fireEvent('alter');
        };
        this.fireEvent = function(type, options){
            this.events[type].each(function(handler){
                handler(options);
            });
        };
        this.addEvent = function(type, handler){
            if(!this.events[type]) this.events[type] = [];
            this.events[type].push(handler);
        };
    };
    IndexedSet.Collection.prototype = {
        lookup : function(value){
            if(
                this.index[value] &&
                this.index[value][this.primaryKey] == value
            ) return this.index[value];
        },
        attachDatasource : function(datasource){
            this.datasource = datasource;
        },
        load : function(callback){
            this.datasource.get(this.options.name, function(data){
                this.index = {};
                data.forEach(function(item){
                    this.index[item[this.primaryKey]] = item;
                }.bind(this));
                callback();
            }.bind(this));
        },
        clone : function(options){
            return new IndexedSet.Set(this, options);
        }
    };
    return IndexedSet;
}));
