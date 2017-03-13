var config = {
	aggregators: [],
	color: '#b71c1c',
	colorbutton: '#EF5350',
	colorfont: '#ffffff',
	locations: 'Location Name',
	locationnames: 'Location Name',
	datafile: 'data/caritas-kasese.csv',
    notesfile: 'data/notes.txt',
	confidenceinterval: false
};

var overlay;

// load data for dashboard

function loadData(){

	var dataCall = $.ajax({
	    type: 'GET',
	    url: config.datafile,
	    dataType: 'text',
	});

    var notesCall = $.ajax({
        type: 'GET',
        url: config.notesfile,
        dataType: 'text',
    });

    $.when(dataCall, notesCall).then(function (dataArgs, notesArgs) {
        initDash(d3.csv.parse(dataArgs[0]), notesArgs[0]);
	});

}

// loaded data pass to dash and crossfilter created to obtain questions
// crossfilter also used to get subset of filtered question

function initDash(data, notes) {

	// crossfilter of data
	cf = crossfilter(data);

	// questions dimensionalised and grouped
	cf.questionsDim = cf.dimension(function(d){return d['Question']});

	cf.questionsGroup = cf.questionsDim.group();

	// get list of unique questions
	var questions = cf.questionsGroup.all().map(function(v,i){
		return v.key;
	});

	// generated question list and if clicked generated graph for question
	questions.forEach(function(q,i){
		$('#questions').append('<div id="question'+i+'" class="questionbox">'+q+'</div>');
		$('#question'+i).on('click',function(){
			cf.questionsDim.filter(q);
			$('#question').html(q);
			genQuestion(cf.questionsDim.top(Infinity));
			if($(window).width()<940){
				$(".questionbox").hide();
				$("#collapse").show();
			}
		})
	});
	console.log($(window).width());
	if($(window).width()<940){
		$(".questionbox").hide();
		$("#collapse").show();
	}

	// render first question be default

	cf.questionsDim.filter(questions[0]);
    $('#notes').html(notes);
	$('#question').html(questions[0]);
	genQuestion(cf.questionsDim.top(Infinity));
	$('#questions').mCustomScrollbar({
        theme: 'minimal-dark',
        advanced: {releaseDraggableSelectors: $(top.document).find('#embedded-viz-iframe').contents()[0]}
	});
}

// question initialisation

function genQuestion(data){

	// create crossfilter of subset
	var cf = crossfilter(data);
	cf.data = data;
	cf.aggs = [];

	// create answer dimension
	cf.answersDim = cf.dimension(function(d){return d['Answer']});

	// aggregators are the dimensions for filtering.  These include the location, answers and aggregators element
	aggregators = [config.locations,config.locationnames,'Answer'].concat(config.aggregators);

	//create crossfilter dimension for each aggregator
	aggregators.forEach(function(agg,i){
		cf.aggs[agg] = {};
		cf.aggs[agg].dim = cf.dimension(function(d){return d[agg]});
		cf.aggs[agg].values = cf.aggs[agg].dim.group().all().map(function(v,i){return v.key;});
	});

	// create groups to display graphs
	cf.answersGroup = cf.aggs['Answer'].dim.group().reduceSum(function(d){return d['Count']});
	cf.locationsGroup = cf.aggs[config.locations].dim.group().reduceSum(function(d){return d['Count']});

	// data for graph
	var data = cf.answersGroup.all();

	// set radio buttons to default graph
	$("input[type=radio][name=chart][value=bar]").prop('checked',true);

	//make sure graphs is showing
	$('#graph').show();

	// draw default graph
	drawGraph(data,false);

	//add radio buttons for chart type
	if(config.confidenceinterval){
		$('#charts').html('<div><button id="barchart" class="chartbutton btn btn-default">Bar chart</button><button id="barper" class="chartbutton btn btn-default">Bar chart (percent)</button><button id="cichart" class="chartbutton btn btn-default">Confidence intervals</button></div>');
	} else {
		$('#charts').html('<div><button id="barchart" class="chartbutton btn btn-default">Bar chart</button><button id="barper" class="chartbutton btn btn-default">Bar chart (percent)</button></div>');
	}

	$('.chartbutton').css({
			'background-color':config.color,
			'color':config.colorfont});
		$('.questbutton').css({
			'background-color':config.color,
			'color':config.colorfont});
	//redraw graph on window change
	$(window).on('resize',function(){
		drawGraph(data,false);
	});

	// generate new graph/map for radio button change
	$('.charttype').on('change',function(){changeRadio(cf);});

	$('.chartbutton').on('click',function(e){
		changeChart(cf,e.currentTarget.id);
	})
}

// action on choosing new graph type

function changeChart(cf,chart){

		//data for graphs
		var data = cf.answersGroup.all();

		currentChart = chart;
		// draw correct graph type
        if(chart=='cichart'){
			$('#graph').show();
			confidenceGraph(data);
			$(window).on('resize',function(){
				confidenceGraph(data);
			});
		} else if(chart=='barchart'){
			$('#graph').show();
			drawGraph(data,false);
			$(window).on('resize',function(){
				drawGraph(data,false);
			});
		} else if(chart=='barper'){
			$('#graph').show();
			drawGraph(data,true);
			$(window).on('resize',function(){
				console.log('resize');
				drawGraph(data,true);
			});
		}
	}

sortKeyValueList = function (x, y) {
	var a = x.key;
	var b = y.key;
	if (isNaN(a) || isNaN(b)) {
		return a - b;
	}
	return parseInt(a) - parseInt(b);
};

function makeKeyValueList(keys, values) {
	var list = [];

	for (i = 0; i < keys.length; i++) {
		var obj = {};
		obj.key = keys[i];
		obj.value = values[i];
		list.push(obj);
	}
	return list;
}

function drawGraph(data,percent){

	$('#graph').html('');

	data = shortenKey(data);

	var total=0;
	data.forEach(function(d){
		total += d.value;
	});
	$('#total').html(Math.max(0, Math.round(total)) + ' respondents');
	var margin = {top: 40, right: 30, bottom: 200, left: 50},
		width = $("#graph").width() - margin.left - margin.right,
		height =  430 - margin.top - margin.bottom;

 	var x = d3.scale.ordinal()
        .rangeRoundBands([0, width]);

	var y = d3.scale.linear()
		.range([height, 0]);

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");

	sortdata = data.slice(0).sort(sortKeyValueList);
	x.domain(sortdata.map(function(d) {return d.key; }));

	var maxy = d3.max(data,function(d){
		return d.value;
	});

	y.domain([0,maxy*1.1]);

	var svg = d3.select("#graph").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    svg.append("g")
		.attr("class", "x axis baraxis")
		.attr("transform", "translate(0," + (height+15) + ")")
		.call(xAxis)
		.selectAll("text")
		.style("text-anchor", "end")
		 .attr("transform", function(d) {
		    return "rotate(-50)"
		});

	svg.append("g").selectAll("rect")
	    .data(data)
			.enter()
	    .append("rect")
	    .attr("x", function(d,i) { return x(d.key)+3; })
	    .attr("width", x.rangeBand()-6)
	    .attr("y", function(d){return y(d.value);})
	    .attr("height", function(d) {return height-y(d.value);})
	    .attr("fill",config.color);

	svg.append("g").selectAll("text")
	    .data(data)
	    .enter()
	    .append("text")
	    .attr("x", function(d){return x(d.key)+x.rangeBand()/2})
	    .attr("y", function(d) {if(height-y(d.value)<30){
	    		return y(d.value)-10;
	    	}
	    	if(x.rangeBand()<60){
	    		return y(d.value)-10;
	    	}
	    	return y(d.value)+25;
	    })
	    .text(function(d){
	    	if(percent){
	    		return d3.format(".1%")(d.value/total);
	    	} else {
				return d3.format(".3d")(Math.max(0, Math.round(d.value)));
	    	}
	    })
	    .style("text-anchor", "middle")
	    .attr("class",function(d){
	    	if(x.rangeBand()>60){
	    		return "numberlabel"
	    	} else {
	    		return "numberlabelsmall"
	    	}
	    })
	    .attr("fill",function(d) {if(height-y(d.value)<30){
	    		return '#000000'
	    	}
	    	if(x.rangeBand()<60){
	    		return '#000000'
	    	}
	    	return '#ffffff';
	    });

}

function confidenceGraph(data,confidence){
	var total = 0;
	confidence = 1.96;

	data = shortenKey(data);

	data.forEach(function(d){
		total += d.value;
	});
	$('#total').html(Math.max(0, Math.round(total)) + ' respondents');
	data.forEach(function(d){
		var p = d.value/total;
		var se = Math.pow((p*(1-p)/total),0.5);
		ci = d.value/total - confidence*se;
		ci3 = 1-1/(total/3);
		d.lower = Math.min(ci,ci3);
		if (d.lower < 0) {
			d.lower = 0
		}
		ci = d.value/total + confidence*se;
		ci3 = 1/(total/3);
		d.upper = Math.max(ci,ci3);
		if (d.upper > 1) {
			d.upper = 1
		}
	});
	$('#graph').html('');

	var margin = {top: 40, right: 30, bottom: 200, left: 50},
		width = $("#graph").width() - margin.left - margin.right,
		height =  430 - margin.top - margin.bottom;

 	var x = d3.scale.ordinal()
        .rangeRoundBands([0, width]);

    var y = d3.scale.linear()
        .range([height,0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

	x.domain(data.map(function(d) {return d.key; }));

	var maxy = d3.max(data,function(d){
		return d.value/total;
	});

	var maxuy = d3.max(data,function(d){
		return d.upper;
	});

	y.domain([0,Math.max(maxy*1.1,maxuy)]);

	var svg = d3.select("#graph").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    svg.append("g")
		.attr("class", "x axis baraxis")
		.attr("transform", "translate(0," + (height+20) + ")")
		.call(xAxis)
		.selectAll("text")
		.style("text-anchor", "end")
		 .attr("transform", function(d) {
		    return "rotate(-50)"
		});

	svg.append("g").selectAll("rect")
	    .data(data)
	    .enter()
	    .append("rect")
	    .attr("x", function(d,i) { return x(d.key)+3; })
	    .attr("width", x.rangeBand()-6)
	    .attr("y", function(d){return y(d.value/total);})
	    .attr("height", function(d) {return height-y(d.value/total);})
	    .attr("fill","#eeeeee");

	svg.append("g").selectAll("line")
	    .data(data)
	    .enter()
	    .append("line")
	    .attr("x1", function(d,i) { return x(d.key)+x.rangeBand()*0.35; })
	    .attr("x2", function(d,i) { return x(d.key)+x.rangeBand()*0.65; })
	    .attr("y1", function(d){return y(d.upper);})
	    .attr("y2", function(d) {return y(d.upper);})
	    .attr("stroke-width",1)
	    .attr("stroke",config.color);

	svg.append("g").selectAll("line")
	    .data(data)
	    .enter()
	    .append("line")
	    .attr("x1", function(d,i) { return x(d.key)+x.rangeBand()*0.35; })
	    .attr("x2", function(d,i) { return x(d.key)+x.rangeBand()*0.65; })
	    .attr("y1", function(d){return y(d.lower);})
	    .attr("y2", function(d) {return y(d.lower);})
	    .attr("stroke-width",1)
	    .attr("stroke",config.color);

	svg.append("g").selectAll("line")
	    .data(data)
	    .enter()
	    .append("line")
	    .attr("x1", function(d,i) { return x(d.key)+x.rangeBand()/2; })
	    .attr("x2", function(d,i) { return x(d.key)+x.rangeBand()/2; })
	    .attr("y1", function(d){return y(d.lower);})
	    .attr("y2", function(d) {return y(d.upper);})
	    .attr("stroke-width",1)
	    .attr("stroke",config.color)
	    .style("stroke-dasharray", ("3, 3"));

	svg.append("g").selectAll("line")
	    .data(data)
	    .enter()
	    .append("line")
	    .attr("x1", function(d,i) { return x(d.key)+3; })
	    .attr("x2", function(d,i) { return x(d.key)+x.rangeBand()-3; })
	    .attr("y1", function(d){return y(d.value/total);})
	    .attr("y2", function(d) {return y(d.value/total);})
	    .attr("stroke-width",1)
	    .attr("stroke",config.color);

	svg.append("g").selectAll("text")
	    .data(data)
	    .enter()
	    .append("text")
	    .attr("x", function(d){return x(d.key)+x.rangeBand()/2})
	    .attr("y", function(d) {return y(d.upper)-10;})
	    .text(function(d){
	    	return d3.format(".1%")(d.upper);
	    })
	    .style("text-anchor", "middle")
	    .attr("class",function(d){
	    	if(x.rangeBand()>60){
	    		return "numberlabel"
	    	} else {
	    		return "numberlabelsmall"
	    	}
	    })
	    .attr("fill",function(d) {return '#000000';});

	svg.append("g").selectAll("text")
	    .data(data)
	    .enter()
	    .append("text")
	    .attr("x", function(d){return x(d.key)+x.rangeBand()/2})
	    .attr("y", function(d) {return y(d.lower)+25;})
	    .text(function(d){
	    	return d3.format(".1%")(d.lower);
	    })
	    .style("text-anchor", "middle")
	    .attr("class",function(d){
	    	if(x.rangeBand()>60){
	    		return "numberlabel"
	    	} else {
	    		return "numberlabelsmall"
	    	}
	    })
	    .attr("fill",function(d) {return '#000000';});

	$('#graph').append('<p>Confidence intervals calculated for simple random sample method.  Visual not appropriate for other sample methods.</p>');
}

function shortenKey(data){
	data.forEach(function(d){
		if(d.key.length>32){
			d.key = d.key.substring(0,30)+'...';
		}
	});
	return data
}

function stickydiv(){
    var window_top = $(window).scrollTop();
    var div_top = $('#sticky-anchor').offset().top;
    if (window_top > div_top && $(window).width()>=940){
        $('#analysis').addClass('sticky');
    }
    else{
        $('#analysis').removeClass('sticky');
    }
}
var cf;
var currentChart = 'barchart';

$(window).scroll(function(){
    stickydiv();
});

$('#collapse').hide();
$('#expand').on('click',function(){
	$('.questionbox').show();
	$('#collapse').hide();
});
loadData();
