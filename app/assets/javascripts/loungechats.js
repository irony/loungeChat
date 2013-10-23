window.loungeChat = {};

(function() {
	lc = window.loungeChat;
	lc.connectionTimer = "test";
	lc.registerHandlers = function(){
		lc = window.loungeChat;
		socket = lc.socket;
		socket.onopen = function(event) {
			if(loungeChat.chat !== undefined) {
				loungeChat.chat.isOnline(true);
				loungeChat.chat.addMessage(null, "Connection with chat server established.", "login");
			}
			clearTimeout(lc.connectionTimer);
		};
		socket.onmessage = function(event) {
			if (event.data.length) {
				lc.handleMessage(event.data);
			}
		};
		socket.onclose = function(event) {
			if(loungeChat.chat)
				loungeChat.chat.isOnline(false);
			loungeChat.chat.addMessage(null, "Lost connection with server, retrying connection...", "logout");
			lc.connectionTimer = window.setTimeout(lc.connect, 5000);
		};
	};
	lc.connect = function() {
		lc = window.loungeChat;
		lc.socket = new WebSocket("ws://" + window.location.host + "/chat");
		lc.registerHandlers();
		// lc.connectionTimer = window.setTimeout(lc.connect, 5000);
	};
	lc.commands = [];
	lc.commands["login"] = function(argument) {
		if(argument) {
			var dividerPosition = argument.indexOf(":");
			var newuserName = argument.slice(0,dividerPosition);
			var theOtherUsers = $.parseJSON(argument.slice(dividerPosition+1,argument.length));
			if(loungeChat.chat) {
				loungeChat.chat.addUserByName(newuserName, theOtherUsers);
			}
		}
	};

	lc.commands["logout"] = function(argument) {
		if(argument){
			console.log(argument);
			var divider = argument.indexOf(":");
			var olduser = argument.slice(0,divider);
			argument = argument.slice(divider+1,argument.length);
			if(loungeChat.chat)
				loungeChat.chat.addMessage(null,"- Bye bye " + olduser +"!", "logout");
		}
	};

	lc.postMessage = function(message) {
		window.loungeChat.socket.send(message);
	};

	lc.handleMessage = function(message) {
		if(message !== undefined && message.length > 0) {
			console.log("message: ", message);
			var matches = message.match(/(\[LH:)(\w+)(\])/);
			if(matches !== undefined && matches !== null && matches.length > 0 && matches[1] == "[LH:") {
				var command = matches[2];
				var argument = message.slice(command.length+5,message.length);
				lc.commands[command](argument);
			} else {
				var me = $("#userlist").data("me");
				if(loungeChat.chat)
					loungeChat.chat.addMessage(me, message, "message");
			}
			
		}
	};


	//INITIALIZER, let me come last please.
	$(function() {
		lc.connect();
		lc.registerHandlers();
	});

}).call(this);

function userViewModel(name) {
	var self = this;
	self.name = ko.observable(name);
	self.userStyle = ko.observable();
}

function messageViewModel(sender, message, type) {
	var self = this;
	self.sender = ko.observable(sender);
	self.message = ko.observable(message);
	self.type = ko.observable("output_"+type);  //logout, login, message 
	
}

function chatViewModel() {
	var self = this;
	self.messages = ko.observableArray();
	self.users = ko.observableArray();
	self.currentMessage = ko.observable();
	self.currentMessageHasFocus = ko.observable(true);
	self.isOnline = ko.observable(false);
	self.sortedUsers = ko.dependentObservable(function() {
		return this.users.slice().sort(this.sortUsersFunction);
	}, self);


	self.sortUsersFunction = function(a, b) {
        return a.name().toLowerCase() > b.name().toLowerCase() ? 1 : -1;  
	};

	self.postMessage = function(message) {
		loungeChat.postMessage(self.currentMessage());
		self.currentMessage("");
		
	};
	self.addMessage = function(sender, message, type) {
		self.messages.push(new messageViewModel(sender, message, type));			
	};
	self.getUserByName = function(username) {
		return ko.utils.arrayFirst(self.users(), function (user) {
			return user.name() === username ? user : null;
        });
	};
	self.addUserByName = function(name, serverUsers) {
		if(!self.getUserByName(name)) {
			self.users.push(new userViewModel(name));
			self.addMessage("", "- " + name + " just logged in", "login");
		}
		self.syncUserByNames(serverUsers);
	};

	self.syncUserByNames = function(serverUsers) {
		console.log("syncUserByNames");
		window.serverUsers = serverUsers;
		if(serverUsers instanceof String){
			console.log("was string");
			serverUsers = [serverUsers];
		}
		console.dir(serverUsers);
		for (var i = 0; i < serverUsers.length; i++) {
			if(!self.getUserByName(serverUsers[i])){
				self.users.push(new userViewModel(serverUsers[i]));
			}
		}
    };
	self.removeUserByName = function(name) {
		var match = ko.utils.arrayFirst(self.users(), function(item) {
			return name === item.name;
		});
		if (!match) {
			self.users.remove(match);
		}
	};
	self.scrollBottom = function(element, index, data) {
		if (element.nodeType === 1) {
			element = element.parentNode;			
			element.scrollTop = element.scrollHeight;
		}
	};
}
$(document).ready(function() {
	loungeChat.chat = new chatViewModel();

	ko.bindingHandlers.returnKey = {
		init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			ko.utils.registerEventHandler(element, 'keydown', function(evt) {
				if (evt.keyCode === 13 && !evt.shiftKey && $(evt.target).val().length !== 0) {
					evt.preventDefault();
					evt.target.blur();
					valueAccessor().call(viewModel, bindingContext.$data);
					evt.target.focus();
				}
			});
		}
	};

	ko.applyBindings(loungeChat.chat);
});
