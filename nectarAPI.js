if($ == undefined) var $ = jQuery;

_NectarGlobals = {
				
	_defaults: {
		prod_api_url 		: '//my.nectarmembers.com/api/',
		dev_api_url 		: '//nectar.itulstaging.com/api/',
		association_key 	: null,
		user_key 			: null,
		token 				: null,
		dev_mode 			: true,
		member_token 		: null,
	},

	_instance 				: null,

	_guid 					: function() {
	  function s4() {
	    return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	  }
	  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	}
};

class Nectar{

	constructor(data){

		//SET THE DEFAULT DATA		
		if(_NectarGlobals._instance == null){
			this._instance_id 			= _NectarGlobals._guid();
			this._data 					= _NectarGlobals._defaults;
			_NectarGlobals._instance 	= this;
		}
		else{
			this._data 			= _NectarGlobals._instance._data;
		}

		this.data(data);
	}

	set_token_headers(){
		if(this.data().token !== null){
			this.set_token(this.data().token);
		}

		if(this.data().member_token !== null){
			this.set_member_token(this.data().member_token);
		}

		return this;
	}

	set_token(token){

		$.ajaxSetup({headers: {'X-Nectar-Token': typeof(token) == 'string' ? token : token.key}});
		
		return this;
	}

	set_member_token(token){

		$.ajaxSetup({headers: {'X-Nectar-Member-Token': typeof(token) == 'string' ? token : token.key}});
		
		return this;
	}

	data(data){
		if(typeof(data) !== 'undefined' && typeof(data) == 'object'){

			for(var x in data){

				this._data[x] = data[x];

				if(x == 'token') this.set_token(data[x]);
			}
			return this;
		}

		if(typeof(data) == 'string'){
			if(typeof(this._data[data]) !== 'undefined'){
				return this._data[data];
			}
			return null;
		}

		return this._data;
	}

	Request(){
		return new NectarRequest();
	}

	Response(){
		return new NectarResponse();
	}

	association(){
		return this._data._association;
	}

	get_member_token(callback){

		var that = this;

		if($.ajaxSettings.headers !== undefined){
			//delete $.ajaxSettings.headers['X-Nectar-Token'];
			delete $.ajaxSettings.headers['X-Nectar-Member-Token'];
		}

		this.Request().post('request-token', {
			member 			: true,
			member_email 	: email,
			member_password : password,
			assoc_api_key 	: $this.data().association_key
		});
	}

	get_token(callback){

		var that = this;

		if($.ajaxSettings.headers !== undefined){
			delete $.ajaxSettings.headers['X-Nectar-Token'];
			//delete $.ajaxSettings.headers['X-Nectar-Member-Token'];
		}
		
		//REQUEST THE TOKEN
		this.Request().post('request-token', {
			user_api_key 	: this.data().user_key,
			assoc_api_key 	: this.data().association_key
		}, function(result){

			//CHECK FOR SUCCESS
			if(result.success()){

				var token = result;

				if(that.data().member_token !== null){
					that.set_member_token(that.data().member_token);
				}

				that.data({token: {key: result.results.token, expiration: result.results.expires_at}});

				that.Request().get('association', function(result){

					if(result.success()){

						that.data({_association: result.results});

						//TRIGGER THE LOAD EVENT
						$(document).trigger('nectar.API.loaded', [that]);

						if(typeof(callback) == 'function'){
							callback.call(that, token);
						}
					}
					else{

						//TRIGGER THE LOAD EVENT
						$(document).trigger('nectar.API.loaded', [that]);

						//CHECK FOR A CALLBACK AND RUN IT IF NEEDED
						if(typeof(callback) == 'function'){
							callback.call(that, token);
						}
					}
				})
			}
			else{

				//TRIGGER THE LOAD EVENT
				$(document).trigger('nectar.API.loaded', [that]);


				//CHECK FOR A CALLBACK AND RUN IT IF NEEDED
				if(typeof(callback) == 'function'){
					callback.call(that, result);
				}
				else{
					nectarLoading('hide');
				}
			}			
		});

		return this;
	}
}

class NectarResponse extends Nectar{
	
	constructor(){
		super();
	}

	static parse(data){

		//SET DEFAULT RESULTS
		var res = new NectarResult({
			status 	: data.responseJSON.status,
			code 	: data.status,
			results : data.responseJSON
		});

		if(typeof(data.responseJSON) !== 'undefined' && typeof(data.responseJSON.results) !== 'undefined'){

			var results 	= data.responseJSON.results;
			var className 	= data.responseJSON.results.className;
			res.results 	= results;

			if(Array.isArray(results)){
				res.results = new NectarCollection(results);
			}
			else if(eval("typeof "+className) == 'function'){
				res.results = new (eval(className))(results.data);
			}
			else{
				for(var x in res.results){
					var sub_result = res.results[x];

					if(typeof sub_result == 'object' && sub_result.className !== undefined){

						var subClassName = sub_result.className;

						if(eval("typeof "+subClassName) == 'function'){
							res.results[x] = new (eval(subClassName))(res.results[x].data);
						}
					}
				}
			}
		}

		else if(typeof(data.responseJSON) !== 'undefined' && typeof(data.responseJSON.errors) !== 'undefined'){
			res.errors = {code: data.status, errors: data.responseJSON.errors};
		}
		else {
			res.status 	= 'error';
			res.code 	= data.status;
			res.errors 	= {code: data.status, errors: [data.statusText]};
		}

		return new NectarResult(res);
	}
}

class NectarModelRelationship {

	constructor(url){
		if(this.constructor.name !== 'NectarResult' && this.constructor.name !== 'NectarApiToken' && this.constructor.name !== 'NectarCollection'){
			this._orm_data = {
				_api_url 	: url,
				_where 		: [],
				_whereRaw 	: [],
				_orderBy 	: [],
				_limit 		: false,
				_skip 		: false,
				_paginate 	: false,
				_count 		: false,
			}
		}
		return this;
	}

	where(field_name, modifier, value){
		this._orm_data._where.push({
			field_name 	: field_name,
			modifier 	: modifier,
			value 		: value
		});

		return this;
	}

	whereRaw(query){
		this._orm_data._whereRaw.push(query);

		return this;
	}

	orderBy(field_name, direction = 'ASC'){
		this._orm_data._orderBy.push({
			field_name 	: field_name,
			direction 	: direction
		});

		return this;
	}

	limit(val){
		this._orm_data._limit = val;
		return this;
	}

	skip(val){
		this._orm_data._skip = val;
		return this;
	}

	count(val = true){
		this._orm_data._count = val;
		return this;
	}

	paginate(val = 20, page = 1){

		if(val == false){
			this._orm_data._paginate = val;
		}
		else{
			this._orm_data._paginate = {
				show: val,
				page: page
			}
		}
		return this;
	}

	get(callback){

		var that = this;

		var request = new NectarRequest();

		var send_data = {
			where 		: this._orm_data._where,
			whereRaw 	: this._orm_data._whereRaw,
			orderBy 	: this._orm_data._orderBy,
			limit 		: this._orm_data._limit,
			skip 		: this._orm_data._skip,
			paginate 	: this._orm_data._paginate,
			count 		: this._orm_data._count,
		};

		if(send_data.count == true){
			return request.post(this._orm_data._api_url, send_data, function(result){
				callback(result.results.first().data.count);
			});
		}

		if(send_data.paginate !== false){
			return request.post(this._orm_data._api_url, send_data, function(result){
				var paginator = result.results.first();
				paginator.model = that;
				callback(paginator);
			});
		}

		return request.post(this._orm_data._api_url, send_data, callback);
	}
}

class NectarModel extends NectarModelRelationship{

	constructor(data){
		
		super();

		this.set(data);
		if(this.constructor.name !== 'NectarResult' && this.constructor.name !== 'NectarApiToken' && this.constructor.name !== 'NectarCollection'){
			this._orm_data._api_url = (this.urlOverride !== undefined ? (this.urlOverride()) : (this.constructor.name+'').replace('Nectar', '').toLowerCase())+(typeof this.id !== 'undefined' ? '/'+this.id : '');
		}
	}

	call(name, args){
		if(this[name] && typeof this[name] == 'function'){
			this[name].call(args);
		}
		else{
			console.log('found a nonexistant method');
		}
	}

	relationship(url){
		return new NectarModelRelationship(this._orm_data._api_url+'/'+url);
	}

	Request(){
		return new NectarRequest();
	}

	Response(){
		return new NectarResponse();
	}

	success(){
		return true;
	}

	getData(){
		var res = {};

		for(var x in this){
			if(x !== '__proto__'){
				res[x] = this[x];
			}
		}

		return res;
	}

	
	static load(className, data){
		var model = new (eval(className))(data);
		var res = new Proxy(model, {
			get: function(target, prop){
				if(target[prop] === undefined){

				}
				else{

					if(typeof target[prop] !== 'function'){
						return function(){
							return target[prop];
						}
					}					

					return target[prop];
				}
			}
		});
		return res;
	}
	

	set(data){

		if(typeof(data) == 'object'){

			if(data.className !== undefined && data.data !== undefined && data.className == this.constructor.name){
				return this.set(data.data);
			}

			for(var x in data){

				if(data[x] !== null){
					if(Array.isArray(data[x])){
						data[x] = new NectarCollection(data[x]);
					}
					else if(typeof(data[x]) == 'object' && typeof(data[x].className) !== 'undefined'){
						var className = data[x].className;

						if(eval("typeof "+className) == 'function'){
							data[x] = new (eval(className))(data[x].data);
						}											
					}
					else if(typeof data[x] == 'object' && data[x].date !== undefined && data[x].timezone !== undefined && data[x].timezone_type !== undefined){
						data[x] = new Date(data[x].date);
						//console.log(data[x].dateObj.toISOString());
					}
					else if(typeof(data[x]) == 'string'){

						if(x == 'id'){
							if(this.constructor.name !== 'NectarResult' && this.constructor.name !== 'NectarApiToken' && this.constructor.name !== 'NectarCollection'){
								this._orm_data._api_url = (this.constructor.name+'').replace('Nectar', '').toLowerCase()+(typeof this.id !== 'undefined' ? '/'+this.id : '');
							}
						}

						if(data[x] == 'false'){
							data[x] = false;
						}

						if(data[x] == 'true'){
							data[x] = true;
						}
					}
					/*
					if(typeof data[x] == 'object' && data[x].date !== undefined && data[x].timezone !== undefined && data[x].timezone_type !== undefined){
						data[x].dateObj = new Date(data[x].date);
						//console.log(data[x].dateObj.toISOString());
					}
					*/
				}				
				this[x] = data[x];
			}
		}
		return this;
	}
	
	update(data, callback){
		
		var res = this.set(data);
		var that = this;
		var url = (_NectarGlobals._instance._data.member_token ? 'update/' : '')+this._orm_data._api_url;
		return res.Request().post(url, this, function(res){

			if(res.success()){
				that.set(res.results.getData());
				//console.log(res.results);
				//console.log(res.results.getData());
				//that.set(this.data());
			}
			//console.log(this);
			//console.log(that);
			if(typeof callback == 'function'){
				callback(res);
			}
		});
	}

	data(){

		return this._data;
	}
}

class NectarPagination extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}

	each(callback){
		this.records.each(callback);
	}

	pages(){

		return this.navigation;
		
		/*
		var res = {
			prev: false,
			next: false,
			pages: [],
			total: this.total,
			first: this.first,
			last: this.last,
		};

		var low_5 	= 1;
		var high_5 	= 5;

		if(this.page > 5){
			var low_5 	= Math.floor(this.page/5)*5;
			var high_5 	= low_5+4;
		}

		if(low_5 > 1) res.prev = low_5;
		if(high_5 > this.page_count) high_5 = this.page_count;
		if(high_5 > this.page) res.next = high_5;

		for(var x = low_5; x <= high_5; x++) res.pages.push({page: x, current: (this.page == x)});

		if(res.pages.length == 1 && res.prev == false){
			//res.pages = [];
		}

		return res;
		*/
	}
}

class NectarCollection extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}

	total(){
		var i = 0;
		for(var x in this){
			i++;
		}

		return i;
	}

	first(){
		return this[0];
	}

	last(){
		for(var x in this){
			continue;
		}

		return this[x];
	}

	nth(number){
		return this[number];
	}

	each(callback){
		for(var x in this){
			if(x !== '__proto__'){
				callback.call(this[x], x, this[x]);
			}
		}
	}
}

class NectarResult extends NectarModel{

	constructor(data){
		super(data);
	}

	success(){
		return this.status == 'success' ? true : false;
	}

	error(){
		return this.status == 'error' ? true : false;
	}

	errorMessages(){
		return new NectarCollection(this.errors.errors);
	}

	each(callback){
		this.results.each(callback);
	}
}

class NectarModelApiCalls extends NectarModel {

	constructor(data){
		super(data);

		return this;
	}

	urlOverride(){
		return this.constructor.name.replace('Nectar', '').toLowerCase();
	}

	create(data = {}, callback){
		this.set(data);
		return this.Request().post(this.urlOverride()+'/add', this, callback);
	}

	update(data = {}, callback){
		this.set(data);
		return this.Request().post(this.urlOverride()+'/update/'+this.id, this, callback);
	}

	remove(callback){
		return this.Request().post(this.urlOverride()+'/delete/'+this.id, this, callback);
	}
}

class NectarApiToken extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarVenue extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarEvent extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarSubscription extends NectarModel {

	constructor(data){
		super(data);

		return this;
	}
}

class NectarPhone extends NectarModelApiCalls{

	constructor(data){
		super(data);

		return this;
	}

}

class NectarEmail extends NectarModelApiCalls{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarAddress extends NectarModelApiCalls{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarSocialMedia extends NectarModelApiCalls{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarFile extends NectarModelApiCalls{

	constructor(data){
		super(data);

		return this;
	}

	getInputFile(input, callback){
		var files = input.get(0).files;
		if (files && files[0]) {

			var file = files[0];

			this.readFromInputFile(file).done(function(base64data){

				var parts 		= base64data.split(';base64,');

				callback({
					mime_type 	: file.type,
					b64data 	: parts[1],
					size 		: file.size,
					name 		: file.name,
					ext 		: file.name.split('.').pop()
				});
			});
		}
		else{
			callback(false);
		}
	}

	readFromInputFile(file){

		var deferred = $.Deferred();
		var fr = new FileReader();
		fr.onload = function(e) {
			deferred.resolve(e.target.result);
		};
		fr.readAsDataURL(file);

		return deferred.promise();
	}

	createFromInput(input, callback){

		var that = this;
		this.getInputFile(input, function(file){
			that.create(file, function(res){
				if(typeof callback == 'function'){
					if(res.success()){
						callback(res.results);
					}
					else{
						callback(res);
					}
				}
			});
		});
	}
}

class NectarCreditCard extends NectarModelApiCalls{

	constructor(data){
		super(data);

		return this;
	}

	urlOverride(){
		return 'card';
	}

	/*
	create(data = {}, callback){
		this.set(data);
		return this.Request().post('card/add', this, callback);
	}

	update(data = {}, callback){
		this.set(data);
		return this.Request().post('card/update/'+this.id, this, callback);
	}

	remove(callback){
		return this.Request().post('card/delete/'+this.id, this, callback);
	}
	*/

	checkout(cartItems, callback){
		
		//FORCE ITEMS INTO COLLECTION
		if(cartItems instanceof NectarCartItem){ cartItems = new NectarCollection([cartItems]); }

		//DEFINE ITEM IDS
		var cartItemIds = [];

		//ADD THE ITEMS
		cartItems.each(function(k, v){cartItemIds.push(v.id); });

		//MAKE THE REQUEST
		return this.Request().post('card/process-cart/'+this.id, {cartItems: cartItemIds}, callback);
	}
}

class NectarCartItem extends NectarModel {

	constructor(data){
		super(data);

		return this;
	}

	urlOverride(){
		return 'cart';
	}

	create(data = {}, callback){
		this.set(data);
		return this.Request().post('cart/add', this, callback);
	}

	update(data = {}, callback){
		this.set(data);
		return this.Request().post('cart/update/'+this.id, this, callback);
	}

	remove(callback){
		return this.Request().post('cart/delete/'+this.id, this, callback);
	}
}

class NectarAssoc extends NectarModel{

	constructor(data){
		super(data);
		this._orm_data._api_url = 'association';

		return this;
	}

	invoices(){
		return this.relationship('invoices');
	}

	members(){
		return this.relationship('members');
	}
}

class NectarMember extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}

	organizations(){
		return this.relationship('organizations');
	}

	invoices(){
		return this.relationship('invoices');
	}

	thumbUrl(){
		return this.image !== undefined ? this.image.thumbnail : '//placehold.it/40x40';
	}
}

class NectarOrganization extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarTransaction extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}
}

class NectarUser extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}

	organizations(){
		return this.relationship('organizations');
	}
}

class NectarInvoice extends NectarModel{

	constructor(data){
		super(data);

		return this;
	}

	download(){
		window.location.href = this.url;
	}

	member(){
		return this.relationship('member');
	}

	items(){
		return this.relationship('items');
	}

	transactions(){
		return this.relationship('transactions');
	}

	user(){
		return this.relationship('user');
	}
}

class NectarInvoiceItem extends NectarInvoice{

	constructor(data){
		super(data);

		return this;
	}

	invoice(){
		return this.relationship('invoice');
	}
}

class NectarRequest extends Nectar{

	constructor(){
		super();

		this._ajax_call;
		this._obj = null;
	}

	convert_data(obj, form, namespace){

		if(obj instanceof FormData){
			return obj;
		}

		if(this._obj === null && obj instanceof NectarModel){
			this._obj = obj;
		}

		let fd = form || new FormData();
		let formKey;

		for(let property in obj) {
			if(obj.hasOwnProperty(property) && obj[property]) {

				formKey = namespace ? namespace + '[' + property + ']' : property;

				//HANDLE DATES
				if(obj[property] instanceof Date){
					fd.append(formKey, obj[property].toISOString());
				}

				//HANDLE NESTED OBJECTS
				else if (typeof obj[property] === 'object' && !(obj[property] instanceof File)) {
			  		this.convert_data(obj[property], fd, formKey);
				}

				//HANDLE STRINGS 
				else {
					fd.append(formKey, obj[property]);
				}
			}
		}

		return fd;
	}

	url(path){
		//this.set_token_headers();
		if(_NectarGlobals._instance._data.member_token !== null) this.set_member_token(_NectarGlobals._instance._data.member_token);
		if(_NectarGlobals._instance._data.token !== null) this.set_token(_NectarGlobals._instance._data.token);
		return (_NectarGlobals._instance._data.dev_mode ? _NectarGlobals._instance._data.dev_api_url : _NectarGlobals._instance._data.prod_api_url) + path;
	}

	__call(d, callback){

		//var that = this._obj !== null ? this._obj : this;

		var params = {
			url: '',
			type : 'get',
			processData: false,
			contentType: false,
			/*
			complete : function(data){
				if(typeof(callback) == 'function'){
					callback.call(that, NectarResponse.parse(data));
				}
			}
			*/
		}

		$.extend(params, d);
		if(typeof(params.data) !== 'undefined' && typeof(params.data) == 'object'){
			params.data = params.data = this.convert_data(params.data);
		}
		else{
			delete params.data;
		}

		if(typeof params.complete === 'undefined'){

			var that = this._obj !== null ? this._obj : this;

			params.complete = function(data){
				if(typeof(callback) == 'function'){
					var res = NectarResponse.parse(data);
					if(that instanceof NectarModel && res.success()){
						if(typeof res.results == 'object'){
							console.log(res.results);
							that.set(res.results.getData());
						}
						
					}
					callback.call(that, res);
				}
			}
		}

		return $.ajax(params);
	}

	get(url, callback = null){
		this._ajax_call = this.__call({
			url: this.url(url)
		}, callback);

		return this;
	}

	post(url, data = {}, callback){
		this._ajax_call = this.__call({
			url 	: this.url(url),
			type 	: 'post',
			data 	: data,
		}, callback);

		return this;
	}

	put(url, data = {}, callback){
		this._ajax_call = this.__call({
			url 	: this.url(url),
			type 	: 'put',
			data 	: data,
		}, callback);

		return this;
	}

	delete(url, callback){
		this._ajax_call = this.__call({
			url 	: this.url(url),
			type 	: 'delete',
		}, callback);

		return this;
	}

	complete(callback){

		var that = this;
		this._ajax_call.complete(function(data){
			if(typeof(callback) == 'function'){
				callback.call(that, NectarResponse.parse(data));
			}
		});

		return this;
	}
}

var nectarLoadingAnimationInterval;function nectarLoading(A){if(A=void 0==A?"show":A,$(".nectar-loading-wrap").length||"show"!=A)$(".nectar-loading-wrap").length&&"hide"==A&&$(".nectar-loading-wrap").fadeOut(300,function(){$(this).remove(),clearInterval(nectarLoadingAnimationInterval)});else{$("body").append('<div class="nectar-loading-wrap" style="display:none; position:fixed; top:0; left:0; bottom:0; right:0; background: rgba(255,255,255,0.8); z-index:9999;"><div class="nectar-loading-animation" style="width:178px; height:149px; position:absolute; left:50%; margin-left:-89px; top:50%; margin-top:-75px;"></div></div>'),$(".nectar-loading-animation").css("background-position","left center").css("background-image","url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABvQAAACVCAYAAACHMh1CAAAgAElEQVR4XuydB5jUxPvHk2y53rijNwUEaQoiIIiKoqjo34b8FBtiF0GliIIoAoIiIDZEFOlNUOlNpEhHOlKPAw6u9726Ncn/mb3N3uzcTJK9AnfHe8/Dw5ZsMvnMd968mW9mhufgDwgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAgSpLgK+yJYOCAQEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgwIGhByIAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAlWYABh6VbhyoGhAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAw90AAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQqMIEwNCrwpUDRQMCQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACYOiBBoAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIBAFSYAhl4VrhwoGhAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAQw80AASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASqMAEw9Kpw5UDRgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAYeqABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIFCFCYChV4UrB4oGBIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABCrT0PNn3zJUBRAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAqUJ+GO66eFXEfsDc08PadgGCAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkDguiBQEQacAoq1L61jsAw8MPauCwnCSQIBIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACKgR0DLb/KFH7kt5r+cYinlHM/HA2POnFmBbIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACACBGkVAj9mm54Tx/dCMPK3j4KYdy9wDY09PTcA2QAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACNYqAltGm52TVzDw1c4806EgjD71nbaOnXLANEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEKj2BCrD0MNNPNLQYx0PN/PA2Kv2soITAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQqCgC5TX0yNF5XgPvqx3fdTMGBnQ5sWnfr/M+m2flOA59p2bokaaemsmHzh+m4KwoFcB+gAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEqiyByjD03MbdKyNfCby1X/fFPC83tKTnvPtpn5FHPRRox6SZecqUm/jUmzANZ5WVEhQMCAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkCgMghUlKGHj75TXvOfb5naJbxWrTU8Jwe77M6Z25fsmLLmh2X5xEg9PWYebu4hDmDsVYYaYJ9AAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJVjkBFG3peMw+Zdg06NTAM/+GzL81mwxB05pIknclKyRo1/rGP/sFMPZahJ2HGHdoGvcfNPHKtPeW7KgcZCgQEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEykqgMg09AZl27/w8rPHNHdts5AS+maeQTofVsXj/mj1frvhqUSZWcHKKTcXQI/+H0XplrW34HRAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAQLUjUFmGntvM4zgO/S98sWX6/0Jrhf/EcZxJOaAkSQkZSZnjv37983WFGYWKaYcAKqPxlP9xQ48ctae2vp4ygq/aVQoUGAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgoBCrT0HObeehfy56dAt6e9PpMY4DpaXRg70F5TrLZ7OuPrN//+ZKJC654CqWYdMi8I8088jOaoUcaeWDsgd6vFgFWewINXq0agOMAASAABIAAEAAC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)"),$(".nectar-loading-wrap").fadeIn(300);var z=0,P=!0,t=0;nectarLoadingAnimationInterval=setInterval(function(){$(".nectar-loading-animation").css("background-position",z+"px 0px"),9===(t+=1)&&(t=0,z=0,P=!P),P?z-=178:z+=178},45)}}