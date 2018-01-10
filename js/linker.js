var memory = new Array(1 << 20).fill(-1); // memory contents
var proglist = [];
var LL;

function readfile(f)
{
    r = new FileReader();
    r.readAsText(f.files[0]);
    r.onload = function(event)
    {
    	t1.innerText = event.target.result;
    	proglist.push(p = new Program(event.target.result));
    	
    	btn_link.disabled = false;
    	console.log(p.head.pname + " has been selected.");
    }
}

function viewMemory(from, to) // to = from + proglist.reduce(function(p, q){return p.head.length > q.head.length ? p : q;}).head.length
{
	res = [];
	for(var i = from; i < to + 1; i++)
		res.push(memory[i] === -1 ? "XX" : toHex(memory[i], 2));
	return res;
}

function toHex(n, pad)
{
	return ("0000000000" + n.toString(16)).substr(-pad).toUpperCase();
}


class Program
{
	constructor(rawRecord)
	{
		this.rawRecord = rawRecord;
		this.text = []; this.mod = [];
		for(var i of rawRecord.split('\n'))
		{
			r = {'H' : 'head', 'D' : 'def', 'R' : 'ref', 'T' : 'text', 'M' : 'mod', 'E' : 'end'}[i[0]];
			if(typeof this[r] === "object") // treat text and mod as arrays
				this[r].push(this.parseRecord(i));
			else
				this[r] = this.parseRecord(i);
		}
	}

	parseRecord(genericRecord)
	{
		var x = genericRecord.split("^");
		switch(genericRecord[0])
		{
			case 'H':
				return {
						pname : x[1].trim(),
						start : parseInt(x[2], 16),
						length : parseInt(x[3], 16)
						};

			case 'D':
			{
				var d = [];
				for(var i = 1; i < x.length; i += 2)
					d.push({name : x[i].trim(), address : parseInt(x[i + 1], 16)});
				return d;
			}

			case 'R': //handle ref no later
			{
				var r = [];
				for(var i of x.slice(1))
					r.push({name : i.trim()});
				return r;
			}

			case 'T':
	    		return {
	        			start: parseInt(x[1], 16),
	        			length: parseInt(x[2], 16),
	        			objectcode: x.slice(3).join("").match(/.{2}/g).map(x => parseInt(x, 16))
	    				};

			case 'M':
				return {
						start : parseInt(x[1], 16),
						disp : parseInt(x[2], 16),
						sign: x[3][0],
						symbol : x[3].substring(1).trim() //stray white spaces
						};

			case 'E':
				return {
						address : parseInt(x[1], 16)
						};
			default:
				console.log("parseRecord Failed: Unknown Record");
		}
	}
}

class Linker
{
	constructor(plist, mode, osstart) // plist[0].head.start)
	{
		this.EST = [];
		this.osstart = osstart;
		this.mode = mode;
		this.plist = plist;

		this.generateEST();
		this.loadOnMem();
		if(this.mode === "relative")
			this.applyMod();
	}

	generateEST()
	{
		var x = this.mode === "relative" ? this.osstart : 0; // shouldnt be zero
		for(var p of this.plist)
		{
			this.EST[p.head.pname] = x; // add program name to EST
			for(var d of p.def)
				this.EST[d.name] = d.address + x; // - p.head.start;
			x += this.mode === "relative" ? p.head.length : 0;
		}
	}

	getSymbolAddress(symbol)
	{
		// return this.EST[symbol] == undefined ? -1 : this.EST[symbol];
		return this.EST[symbol];
	}

	loadOnMem()
	{
		var loc;
		for(var p of this.plist)
		{
			loc = this.mode === "relative" ? this.getSymbolAddress(p.head.pname) : p.head.start;
			for(var t of p.text)
				for(var i = 0; i < t.length; i++)
					memory[loc + t.start + i] = t.objectcode[i]; // loc + t.start + i - p.head.start
			loc += this.mode === "relative" ? p.head.length : 0;
		}
	}

	applyMod()
	{
		var x, loc;
		for(var p of this.plist) // load each program
			for(var m of p.mod) // load each mod record
			{
				loc = this.getSymbolAddress(p.head.pname) + m.start; // - m.disp % 2; // this can't be right
				x = this.getSymbolAddress(m.symbol); // ask EST instead
				
				function sHEX3(p)
				{
					var q = [];
					for(var i = 0; i < 3; i++, p >>= 8)
						q.unshift(p % 256); //prepend result
					return q;
				}

				x = sHEX3(x);

				if(m.sign === '-')
				{
					x.map(p => -1 * p); // this doesnt work for some reason
					x[0] = -x[0];
					x[1] = -x[1];
					x[2] = -x[2];
				}

				for(var i = 0; i < 3; i++)
					memory[loc + i] += x[i];
			}
	}
}

function link()
{
	mode = r1.checked ? r1.value : r2.value;
	osstart = eval("0x" + t_start.value);
	LL = new Linker(proglist, mode, osstart);
	console.log("Done Linking.");
}

function appendMemRow()
{
	memtable.hidden = false;
	from = Math.floor(parseInt(t_start.value, 16) / 16) * 16;
	to = 0;
	if(LL.mode === "relative")
		for(p of LL.plist)
			to += p.head.length;
	else
		for(p of LL.plist)
			to = Math.max(to, p.head.length);

	vm = viewMemory(from, from + to + 16);

	for(var row = 0; row < to / 16; row++)
	{
		memtable.insertRow();
		c = memtable.rows[row + 1].insertCell();
		c.innerText = toHex(16 * row + from, 6);
		c.className = "memaddr";
		for(i = 0; i < 16; i++)
			memtable.rows[row + 1].insertCell().innerText = vm[16 * row + i];
	}
	btn_viewMem.disabled = true;
}