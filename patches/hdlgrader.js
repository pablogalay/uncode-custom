async function updateWaveDromBlock(blockId, text) {
  await loadScript("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js");
  await loadScript("https://cdn.jsdelivr.net/npm/@fortawesome/free-solid-svg-icons@6.7.2/index.min.js");
  await loadScript("https://cdn.jsdelivr.net/gh/pablogalay/d3-waveMOD@master/dist/d3-wave.js");

  const target = document.getElementById(blockId);
  if (!target) {
    console.warn(`Elemento con ID '${blockId}' no encontrado.`);
    return;
  }

  // Si el contenedor aún no existe, se crea 
  let svg = document.getElementById("wave-graph");
  if (!svg) {
    // Estilos
    if (!document.getElementById("wave-style")) {
      const style = document.createElement("style");
      //Se añaden los estilos básicos para la librería
      style.id = "wave-style";
      style.textContent = `
        #wave-graph {
          width: 100%;
          min-width: 300px;
          height: 400px;
          margin-top: 30px;
        }
      `;
      document.head.appendChild(style);
    }

    //Lineas encargadas de imprimir los resultados de la ejecución del código
    let block = $('#' + blockId);
    block.html(parseOutputDiff(text) + parseHDL(text));
    

    // Crear contenedor y SVG
    const container = document.createElement("div");
    container.id = "wave-container";
    container.style.width = "100%";
    container.style.height = "450px";

    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "wave-graph";

    container.appendChild(svg);
    target.appendChild(container);
  }


  const intervalId = setInterval(() => {
    // Se comprubea si el SVG ya está disponible
    const currentSvg = document.getElementById("wave-graph");
    if (currentSvg) {
      // Si el SVG ya está disponible, se procede a inicializar el wave graph
      try {
        const jsonData = parseHDLToJSON(text);
        const data = JSON.parse(jsonData);
        const d3svg = d3.select("#wave-graph");
        const waveGraph = new d3.WaveGraph(d3svg);
 
        waveGraph.bindData(data);
        waveGraph.setSizes();
 
        function draw(signalData){
            waveGraph.bindData(signalData);
        }
 
        function resize() {
            waveGraph.setSizes();
        }
 
        d3.select(window).on("resize", resize);
        draw(data);
       
        // Se elimina el intervalo una vez que se ha inicializado correctamente
        clearInterval(intervalId);
      } catch (e) {
        // Si ocurre un error durante la inicializacion
        console.error("Error al inicializar wave graph:", e);
      }
    }
  }, 2000); // Se intenta cada 2 segundos
}



/*// Función que espera hasta que el ancho del SVG sea válido
function waitForValidWidth(element, callback, retries = 20) {
  const width = element.getBoundingClientRect().width;

  if (width < 50) {
    if (retries > 0) {
      console.warn(`Esperando ancho adecuado (${width}px)...`);
      setTimeout(() => waitForValidWidth(element, callback, retries - 1), 500);
    } else {
      console.error("No se pudo obtener un ancho válido para el SVG.");
    }
  } else {
    callback();
  }
}*/

// Función para cargar un script 
async function loadScript(url) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }


function parseHDLToJSON(diff) {
    const lines = diff.split('\n');
 
    const inputs = new Map();
    const outputs = new Map();
 
 
    const inputsTeacher = new Map();
    const outputsTeacher = new Map();
    const inputsStudent = new Map();
    const outputsStudent = new Map();
 
    separateData(lines, inputs, outputs, inputsTeacher, outputsTeacher, inputsStudent, outputsStudent);
 
    compareProfessorAndStudent(inputs, inputsTeacher, inputsStudent);
    compareProfessorAndStudent(outputs, outputsTeacher, outputsStudent);
 
    function sortPairSignals(dataMap) {
        const grouped = new Map();
 
        for (const key of dataMap.keys()) {
            const baseName = key.endsWith('*') ? key.slice(0, -1) : key;
            if (!grouped.has(baseName)) grouped.set(baseName, []);
            grouped.get(baseName).push(key);
        }
 
        const sortedKeys = [];
        for (const [baseName, variants] of grouped.entries()) {
            if (variants.includes(baseName)) sortedKeys.push([baseName, dataMap.get(baseName)]);
            if (variants.includes(baseName + '*')) sortedKeys.push([baseName + '*', dataMap.get(baseName + '*')]);
        }
 
        return sortedKeys;
    }
    //console.log(outputs);
 
    /*//ordenar los inputs y outputs por tiempo
    inputs.forEach((value, key) => {
        inputs.set(key, value.sort((a, b) => a[0] - b[0]));
    });
    outputs.forEach((value, key) => {
        outputs.set(key, value.sort((a, b) => a[0] - b[0]));
    });*/
 
    const resultJSON = {
        name: "Results",
        type: {
            name: "struct"
        },
        children: [
            {
                name: "Inputs",
                type: {
                    name: "struct"
                },
                children: []
            },
            {
                name: "Outputs",
                type: {
                    name: "struct"
                },
                children: []
            }
        ]
    };
 
    // Añadir inputs a la estructura JSON
    for (const [key, value] of sortPairSignals(inputs)) {
        const inputJSON = {
            name: key,
            type: {
                width: value[0][1].startsWith("b") ? value[0][1].length - 1 : value[0][1].length,
                name: "wire"
 
            },
            data: value
        };
        resultJSON.children[0].children.push(inputJSON);
    }
 
    // Añadir outputs a la estructura JSON
    for (const [key, value] of sortPairSignals(outputs)) {
        const outputJSON = {
            name: key,
            type: {
                width: value[0][1].startsWith("b") ? value[0][1].length - 1 : value[0][1].length,
                name: "wire"
 
            },
            data: value
 
        };
        resultJSON.children[1].children.push(outputJSON);
    }
 
    return JSON.stringify(resultJSON, null, 2);
}
 
 
 
function parseHDLline(line) {
    const result = {
        type: null,
        time: 0,
        inputs: {},
        outputs: {}
    };
 
    let tokens = [];
 
    if (line[0] == '+' || line[0] == '-') {
        tokens = line.slice(1).trim().split(',');
        result.type = line[0] === '+' ? 'teacherAnswer' : 'studentAnswer';
    } else {
        tokens = line.split(',');
        result.type = 'neutral'
    }

    i = 0;
 
    while (i < tokens.length) {
        const token = tokens[i].trim();
        if (token === 'T') {
            result.time = parseInt(tokens[i + 1].trim());
            i++;
        } else if (token === 'INPUTS') {
            i++;
            while (i < tokens.length && tokens[i].trim() !== 'OUTPUTS') {
                inputName = tokens[i++].trim();
                inputValue = tokens[i++].trim();
 
                result.inputs[inputName] = inputValue;
            }
        } else if (token === 'OUTPUTS') {
            i++;
            while (i < tokens.length) {
                outputName = tokens[i++].trim();
                outputValue = tokens[i++].trim();
 
                result.outputs[outputName] = outputValue;
            }
        } else {
            i++;
        }
 
    }
    return result;
}
 
function separateData(lines, inputs, outputs, inputsTeacher, outputsTeacher, inputsStudent, outputsStudent) {
    for (const line of lines) {
        const parsedLine = parseHDLline(line);
 
        let time = parsedLine.time * 1000;
 
        if (parsedLine.type == 'teacherAnswer') {
            for (const [key, value] of Object.entries(parsedLine.inputs)) {
                if (!inputsTeacher.has(key)) {
                    inputsTeacher.set(key, []);
                    if (value.length > 1)
                        inputsTeacher.get(key).push([time, 'b' + value]);
                    else
                        inputsTeacher.get(key).push([time, value]);
                } else {
                    if (value.length > 1)
                        inputsTeacher.get(key).push([time, 'b' + value]);
                    else
                        inputsTeacher.get(key).push([time, value]);
                }
            }
            for (const [key, value] of Object.entries(parsedLine.outputs)) {
                let teacherKey = key;
                if (!outputsTeacher.has(teacherKey)) {
                    outputsTeacher.set(teacherKey, []);
                    if (value.length > 1)
                        outputsTeacher.get(teacherKey).push([time, 'b' + value]);
                    else
                        outputsTeacher.get(teacherKey).push([time, value]);
                } else {
                    if (value.length > 1)
                        outputsTeacher.get(teacherKey).push([time, 'b' + value]);
                    else
                        outputsTeacher.get(teacherKey).push([time, value]);
                }
            }
        } else if (parsedLine.type == 'studentAnswer') {
            for (const [key, value] of Object.entries(parsedLine.inputs)) {
                if (!inputsStudent.has(key)) {
                    inputsStudent.set(key, []);
                    if (value.length > 1)
                        inputsStudent.get(key).push([time, 'b' + value]);
                    else
                        inputsStudent.get(key).push([time, value]);
                } else {
                    if (value.length > 1)
                        inputsStudent.get(key).push([time, 'b' + value]);
                    else
                        inputsStudent.get(key).push([time, value]);
                }
            }
            for (const [key, value] of Object.entries(parsedLine.outputs)) {
                let studentKey = key;
                if (!outputsStudent.has(studentKey)) {
                    outputsStudent.set(studentKey, []);
                    if (value.length > 1)
                        outputsStudent.get(studentKey).push([time, 'b' + value]);
                    else
                        outputsStudent.get(studentKey).push([time, value]);
                } else {
                    if (value.length > 1)
                        outputsStudent.get(studentKey).push([time, 'b' + value]);
                    else
                        outputsStudent.get(studentKey).push([time, value]);
                }
            }
        } else if (parsedLine.type == 'neutral') {
            for (const [key, value] of Object.entries(parsedLine.inputs)) {
                if (!inputs.has(key)) {
                    inputs.set(key, []);
                    if (value.length > 1)
                        inputs.get(key).push([time, 'b' + value]);
                    else
                        inputs.get(key).push([time, value]);
                } else {
                    if (value.length > 1)
                        inputs.get(key).push([time, 'b' + value]);
                    else
                        inputs.get(key).push([time, value]);
                }
            }
            for (const [key, value] of Object.entries(parsedLine.outputs)) {
                if (!outputs.has(key)) {
                    outputs.set(key, []);
                    if (value.length > 1)
                        outputs.get(key).push([time, 'b' + value]);
                    else
                        outputs.get(key).push([time, value]);
                } else {
                    if (value.length > 1)
                        outputs.get(key).push([time, 'b' + value]);
                    else
                        outputs.get(key).push([time, value]);
                }
            }
        }
    }
}
 
function compareProfessorAndStudent(finalData, dataTeacher, dataStudent) {
    for (const [key, teacherValues] of dataTeacher) {
        // Existe el input en el alumno?
        const studentValues = dataStudent.get(key);
        if (studentValues) {
            if (JSON.stringify(teacherValues) !== JSON.stringify(studentValues)) {
                //Si no son iguales se añaden a la lista de inputs del profesor y del alumno
                if (!finalData.has(key)) finalData.set(key, []);
                finalData.get(key).push(...teacherValues);
                if (!finalData.has(key + '*')) finalData.set(key + '*', []);
                finalData.get(key + '*').push(...studentValues);
            } else {
                //Si son iguales se añaden a la lista de inputs del profesor
                if (!finalData.has(key)) finalData.set(key, []);
                finalData.get(key).push(...teacherValues);
            }
        } else {
 
            if (!finalData.has(key)) finalData.set(key, []);
            finalData.get(key).push(...teacherValues);
        }
    }
 
    for (const [key, val] of finalData) {
        //recorre los inputs y si existe un valor de tiempo que no tiene la key con * se añade
        if (key.endsWith('*')) {
            const originalKey = key.slice(0, -1); // Remove the '*' from the key
            const originalValues = finalData.get(originalKey) || [];
            const starredValues = val;
 
            const existingTimes = new Set(starredValues.map(([time]) => time));
 
            for (const [time, value] of originalValues) {
                if (!existingTimes.has(time)) {
                    starredValues.push([time, value]);
                }
            }
 
 
        }
        //ordenar los inputs y outputs por tiempo
        val.sort((a, b) => a[0] - b[0]);
    }
}
 



function parseHDLline(line){
    const result = {
        type: null,
        time: 0,
        inputs: {},
        outputs: {}
    };

    let tokens = [];


    if(line[0] == '+' || line[0] == '-' ){
        tokens = line.slice(1).trim().split(',');
        result.type = line[0] === '+' ? 'teacherAnswer' : 'studentAnswer';
    }else{
        tokens = line.split(',');
        result.type = 'neutral'
    }

    //console.log(tokens);

    i = 0;

    while(i < tokens.length){
        const token = tokens[i].trim();
        if(token === 'T'){
            result.time = parseInt(tokens[i+1].trim());
            i++;
        }else if(token === 'INPUTS'){
            i++;
            while(i < tokens.length && tokens[i].trim() !== 'OUTPUTS'){
                inputName = tokens[i++].trim();
                inputValue = tokens[i++].trim();

                result.inputs[inputName] = inputValue; 
            }
        }else if(token === 'OUTPUTS'){
            i++;
            while(i < tokens.length){
                outputName = tokens[i++].trim();
                outputValue = tokens[i++].trim();

                result.outputs[outputName] = outputValue;
            }
        }else{
            i++;
        }

    }

    

    //Process the lines that start with '+'/'-' so that all the lines keep the same structure
    
    return result;
}

function parseHDLline(line){
    const result = {
        type: null,
        time: 0,
        inputs: {},
        outputs: {}
    };

    let tokens = [];


    if(line[0] == '+' || line[0] == '-' ){
        tokens = line.slice(1).trim().split(',');
        result.type = line[0] === '+' ? 'teacherAnswer' : 'studentAnswer';
    }else{
        tokens = line.split(',');
        result.type = 'neutral'
    }

    //console.log(tokens);

    i = 0;

    while(i < tokens.length){
        const token = tokens[i].trim();
        if(token === 'T'){
            result.time = parseInt(tokens[i+1].trim());
            i++;
        }else if(token === 'INPUTS'){
            i++;
            while(i < tokens.length && tokens[i].trim() !== 'OUTPUTS'){
                inputName = tokens[i++].trim();
                inputValue = tokens[i++].trim();

                result.inputs[inputName] = inputValue; 
            }
        }else if(token === 'OUTPUTS'){
            i++;
            while(i < tokens.length){
                outputName = tokens[i++].trim();
                outputValue = tokens[i++].trim();

                result.outputs[outputName] = outputValue;
            }
        }else{
            i++;
        }
    }
    //Process the lines that start with '+'/'-' so that all the lines keep the same structure
    return result;
}

function parseHDL(diff){
  let lines = diff.split('\n');
  let inputsG = {};
  let outputsG = {};
  let inputsC = {};
  let outputsC = {};

  let noBinary = {};  
  let dataG = {};
  let dataC = {};

  let result = [];
  let lastTimeGood = 0;
  let lastTimeBad = 0;
  result.push('<script type="WaveDrom">');

  result.push("{signal: [");
  for(let i = 0; i < lines.length; ++i) {
      let line = lines[i];
      let info = line.replace(/ /g,"").split(",");
      let output = null;
      let time = parseInt(info[1]);


      if (line.startsWith("---")) {
        output = '<span class="diff-missing-output">' + line.substring(4) + '</span>';
      } else if (line.startsWith("+++")) {
        output = '<span class="diff-additional-output">' + line.substring(4) + '</span>';
      } else if (line.startsWith("@@")) {
        output = '<span class="diff-position-control">' + line + '</span>';
      } else if (line.startsWith("-")) {
        let is_input = false;
        let is_output = false;
        if(info.length > 2){
            let j = 2;
            while(j < info.length) {
                if(info[j] === "INPUTS"){
                  is_input = true;
                  is_output = false;
                }else if(info[j] === "OUTPUTS"){
                  is_input = false;
                  is_output = true;
                }else{
                  let signal = info[j];
                  let value = info[j+1];
                  if (is_input){
                    if (time == 0){
                        if(signal.includes("[")) {
                            noBinary[signal] = 1;
                            dataG[signal] = [];
                            inputsG[signal] = "2";
                            dataG[signal].push("'"+value+"'");
                        }else{
                            inputsG[signal] = value;
                        }
                    }else{
                      if (signal in noBinary){
                        if (dataG[signal].slice(-1) == "'"+value+"'"){
                          inputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          inputsG[signal] += ".".repeat(time - lastTimeGood-1) + "2";
                          dataG[signal].push("'"+value+"'");
                        }
                      }else{
                        if (inputsG[signal].replace(/\./g,"").slice(-1) === value){
                          inputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          inputsG[signal] += ".".repeat(time - lastTimeGood-1) + value;
                        }
                      }
                    }
                    j++;
                  }else if(is_output){
                    if (time == 0){
                      if(signal.includes("[")) {
                            noBinary[signal] = 1;
                            dataG[signal] = [];
                            outputsG[signal] = "2";
                            dataG[signal].push("'"+value+"'");
                      }else{
                            outputsG[signal] = value;
                      }
                    }else{
                      if (signal in noBinary){
                        if (dataG[signal].slice(-1) == "'"+value+"'"){
                          outputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          outputsG[signal] += ".".repeat(time - lastTimeGood-1) + "2";
                          dataG[signal].push("'"+value+"'");
                        }
                      }else{
                        if (outputsG[signal].replace(/\./g,"").slice(-1) === value){
                          outputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          outputsG[signal] += ".".repeat(time - lastTimeGood-1) + value;
                        }
                      }
                    }
                    j++;
                  }
                }
                j++;
            }

            lastTimeGood = time;
        }

        output = '<span class="diff-missing-output">' + line.substring(1) + '</span>';
      } else if (line.startsWith("+")) {
        let is_input = false;
        let is_output = false;
        if(info.length > 2){
            let j = 2;
            while(j < info.length) {
                if(info[j] === "INPUTS"){
                  is_input = true;
                  is_output = false;
                }else if(info[j] === "OUTPUTS"){
                  is_input = false;
                  is_output = true;
                }else{
                  let signal = info[j];
                  let value = info[j+1];
                  if (is_input){
                    if (time == 0){
                        if(signal.includes("[")) {
                            noBinary[signal] = 1;
                            dataC[signal] = [];
                            inputsC[signal] = "2";
                            dataC[signal].push("'"+value+"'");
                        }else{
                            inputsC[signal] = value;
                        }
                    }else{
                      if (signal in noBinary){
                        if (dataC[signal].slice(-1) == "'"+value+"'"){
                          inputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          inputsC[signal] += ".".repeat(time - lastTimeBad-1) + "2";
                          dataC[signal].push("'"+value+"'");
                        }
                      }else{
                        if (inputsC[signal].replace(/\./g,"").slice(-1) === value){
                          inputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          inputsC[signal] += ".".repeat(time - lastTimeBad-1) + value;
                        }
                      }
                    }
                    j++;
                  }else if(is_output){
                    if (time == 0){
                      if(signal.includes("[")) {
                            noBinary[signal] = 1;
                            dataC[signal] = [];
                            outputsC[signal] = "2";
                            dataC[signal].push("'"+value+"'");
                      }else{
                            outputsC[signal] = value;
                      }
                    }else{
                      if (signal in noBinary){
                        if (dataC[signal].slice(-1) == "'"+value+"'"){
                          outputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          outputsC[signal] += ".".repeat(time - lastTimeBad-1) + "2";
                          dataC[signal].push("'"+value+"'");
                        }
                      }else{
                        if (outputsC[signal].replace(/\./g,"").slice(-1) === value){
                          outputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          outputsC[signal] += ".".repeat(time - lastTimeBad-1) + value;
                        }
                      }
                    }
                    j++;
                  }
                }
                j++;
            }
            lastTimeBad = time;
        }

        output = '<span class="diff-additional-output">' + line.substring(1) + '</span>';
      } else if (line.startsWith(" ")) {
        let is_input = false;
        let is_output = false;
        if(info.length > 2){
            let j = 2;
            while(j < info.length) {
                if(info[j] === "INPUTS"){
                  is_input = true;
                  is_output = false;
                }else if(info[j] === "OUTPUTS"){
                  is_input = false;
                  is_output = true;
                }else{
                  let signal = info[j];
                  let value = info[j+1];
                  if (is_input){
                    if (time == 0){
                        if(signal.includes("[")) {
                            noBinary[signal] = 1;
                            dataC[signal] = [];
                            inputsC[signal] = "2";
                            dataC[signal].push("'"+value+"'");

                            dataG[signal] = [];
                            inputsG[signal] = "2";
                            dataG[signal].push("'"+value+"'");
                        }else{
                            inputsC[signal] = value;
                            inputsG[signal] = value;
                        }
                    }else{
                      if (signal in noBinary){
                        if (dataG[signal].slice(-1) == "'"+value+"'"){
                          inputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          inputsG[signal] += ".".repeat(time - lastTimeGood-1) + "2";
                          dataG[signal].push("'"+value+"'");
                        }

                        if (dataC[signal].slice(-1) == "'"+value+"'"){
                          inputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          inputsC[signal] += ".".repeat(time - lastTimeBad-1) + "2";
                          dataC[signal].push("'"+value+"'");
                        }
                      }else{
                        if (inputsG[signal].replace(/\./g,"").slice(-1) === value){
                          inputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          inputsG[signal] += ".".repeat(time - lastTimeGood-1) + value;
                        }
                        if (inputsC[signal].replace(/\./g,"").slice(-1) === value){
                          inputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          inputsC[signal] += ".".repeat(time - lastTimeBad-1) + value;
                        }
                      }
                    }
                    j++;
                  }else if(is_output){
                    if (time == 0){
                      if(signal.includes("[")) {
                            noBinary[signal] = 1;
                            dataC[signal] = [];
                            outputsC[signal] = "2";
                            dataC[signal].push("'"+value+"'");

                            dataG[signal] = [];
                            outputsG[signal] = "2";
                            dataG[signal].push("'"+value+"'");
                      }else{
                            outputsC[signal] = value;
                            outputsG[signal] = value;
                      }
                    }else{
                      if (signal in noBinary){
                        if (dataC[signal].slice(-1) == "'"+value+"'"){
                          outputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          outputsC[signal] += ".".repeat(time - lastTimeBad-1) + "2";
                          dataC[signal].push("'"+value+"'");
                        }
                        if (dataG[signal].slice(-1) == "'"+value+"'"){
                          outputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          outputsG[signal] += ".".repeat(time - lastTimeGood-1) + "2";
                          dataG[signal].push("'"+value+"'");
                        }
                      }else{
                        if (outputsG[signal].replace(/\./g,"").slice(-1) === value){
                          outputsG[signal] += ".".repeat(time - lastTimeGood);
                        }else{
                          outputsG[signal] += ".".repeat(time - lastTimeGood-1) + value;
                        }
                        if (outputsC[signal].replace(/\./g,"").slice(-1) === value){
                          outputsC[signal] += ".".repeat(time - lastTimeBad);
                        }else{
                          outputsC[signal] += ".".repeat(time - lastTimeBad-1) + value;
                        }
                      }
                    }
                    j++;
                  }
                }
                j++;
            }
            lastTimeGood = time;
            lastTimeBad = time;
        }
      } else if (line.startsWith("...")) {
        output = '<span class="diff-position-control">' + line + '</span>';
      } else if (line === "") {
        // The diff output includes empty lines after position control lines, so we keep them
        // unformatted to avoid misleading the user (they are not actually part of any of the outputs)
        output = line;
      }
  }
  result.push('{name:"Inputs:"},');
  let start = 65; // ASCII for 'A'
  for(var signal in inputsC){
    inputsC[signal] = inputsC[signal].replace("U","x")
    inputsG[signal] = inputsG[signal].replace("U","x")
    if (signal in noBinary){
        if (inputsC[signal] === inputsG[signal] && dataC[signal] === dataG[signal] ){
            result.push('{name:"'+signal+'", wave: "'+inputsG[signal]+'", data:['+dataG[signal]+']},');
        }else{
            dataDiff = parseDiffWaveDromBus(inputsC[signal], inputsG[signal], dataC[signal], dataG[signal]);
            result.push('{name:"'+signal+'", '+dataDiff+'},');
            result.push('{name:"'+signal+'*", wave: "'+inputsG[signal]+'", data:['+dataG[signal]+']},');
        }
    }else{
        if ( inputsC[signal] === inputsG[signal]){
            result.push('{name:"'+signal+'", wave: "'+inputsC[signal]+'"},');
        }else{
            nodes = parseDiffWaveDrom(inputsC[signal], inputsG[signal], start);
            result.push('{name:"'+signal+'", wave: "'+inputsC[signal]+'", node:"'+nodes+'"},');
            result.push('{name:"'+signal+'*", wave: "'+inputsG[signal]+'"},');
            start += (nodes.length - (nodes.match(/\./g) || []).length);
        }
    }
  }
  result.push('{name:"Outputs:"},');
  for(var signal in outputsC){
    outputsC[signal] = outputsC[signal].replace("U","x")
    outputsG[signal] = outputsG[signal].replace("U","x")
    if (signal in noBinary){
        if (outputsC[signal] === outputsG[signal] && JSON.stringify(dataC[signal]) == JSON.stringify(dataG[signal])  ){
            result.push('{name:"'+signal+'", wave: "'+outputsG[signal]+'", data:['+dataG[signal]+']},');
        }else{
            dataDiff = parseDiffWaveDromBus(outputsC[signal], outputsG[signal], dataC[signal], dataG[signal]);
            result.push('{name:"'+signal+'", '+dataDiff+'},');
            result.push('{name:"'+signal+'*", wave: "'+outputsG[signal]+'", data:['+dataG[signal]+']},');
        }
    }else{
        if ( outputsC[signal] === outputsG[signal]){
            result.push('{name:"'+signal+'", wave: "'+outputsG[signal]+'"},');
        }else{
            nodes = parseDiffWaveDrom(outputsC[signal], outputsG[signal], start);
            result.push('{name:"'+signal+'", wave: "'+outputsC[signal]+'", node:"'+nodes+'"},');
            result.push('{name:"'+signal+'*", wave: "'+outputsG[signal]+'"},');
            start += (nodes.length - (nodes.match(/\./g) || []).length);
        }
    }
  }
  result.push("]");
  result.push(', head:{tick: 0}')

  if (start != 65){
    result.push(",\"edge\":[");
    edges = []
    for(let j = 65; j<start;j+=2)
        edges.push("'"+String.fromCharCode(j)+"|-|"+String.fromCharCode(j+1)+" diff'")
    result.push(edges.join(", "));
    result.push("]");
  }
  result.push("}");
  result.push('</script>');

  return result.join("\n");
}

function parseDiffWaveDrom(code, golden, start){
   let node = "";
   let lastC = "";
   let lastG = "";
   let begin = false;
   for (let i=0; i < code.length;i++){
     if (code[i] !== ".") lastC = code[i];
     if (golden[i] !== ".") lastG = golden[i];
     if(lastC !== lastG){
       if (begin){
            node += ".";

       }else{
         node += numberToASCIICode(start);
         start+=1;
         begin = true;
       }
     }else{
       if (begin){
         node += numberToASCIICode(start);
         start+=1;
         begin = false;
       }else{
         node += ".";
       }

     }
   }
   if (begin) node += numberToASCIICode(start);
   return node;

}

function parseDiffWaveDromBus(wcode, wgolden, dcode, dgolden){
    //Compare the wave of the golden model with the student solution
    let wave = "";
    let ndata = [];
    let lastC = "";
    let lastG = "";
    let beginOK = false;
    let beginBad = false;
    let icode = 0;
    let igolden = 0;
    for (let i=0; i < wcode.length;i++){
      if (wcode[i] !== ".") {
        lastC = dcode[icode];
        icode++;
      }
      if (wgolden[i] !== "."){
        lastG = dgolden[igolden];
        igolden++;
      }
      if(lastC != lastG){
        beginOK = false;
        if(lastC != ndata.slice(-1)) beginBad = false;
        if(beginBad){
          wave += '.';
        }else{
          beginBad = true;
          wave += '9';
          ndata.push(lastC);
        }
      }else{
        beginBad = false;
        if(lastC != ndata.slice(-1)) beginOK = false;
        if(beginOK){
          wave += '.';
        }else{
          beginOK = true;
          wave += '2';
          ndata.push(lastC);
        }

      }
    }
    return 'wave: "'+wave+'", data:['+ndata+']';
}

function numberToASCIICode(number){
  let alphabet = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","W","X","Y","Z",
    "0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","w","x","y","z"]
  //let alphabet = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","W","X","Y","Z"]
  if (number - 65 < alphabet.length){
    return alphabet[number - 65];
  }
  return "";
}