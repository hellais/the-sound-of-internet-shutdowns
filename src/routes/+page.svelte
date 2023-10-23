<script>
  import { onMount } from "svelte";
  import JSONTree from "svelte-json-tree";
  import P5 from "p5-svelte";
  import * as d3 from "d3";
  import * as Tone from "tone";

  let iodaURL;
  let iodaData;
  let dataRawValues = {};
  let dataSteps = {};
  let dataMaxValue = {};
  let dataMinValue = {};
  let sketch;

  //onMount(async () => {});

  /*
  const pingSynth = new Tone.Synth({
    oscillator: {
      type: "fmsine4",
      modulationType: "square",
    },
  }).toDestination();

  const lowPass = new Tone.Filter({
    frequency: 14000,
  }).toDestination();

  const closedHiHatEnvelope = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.15,
  }).toDestination();

  const closedHiHat = new Tone.Noise().chain(closedHiHatEnvelope, lowPass);
*/

  const bassFilter = new Tone.Filter({
    frequency: 13000,
  });

  /*
  const bassSynth = new Tone.PulseOscillator("A2", 0.5)
    .chain(bassFilter)
    .toDestination();
  bassSynth.start();
  */

  const bassSynth = new Tone.MonoSynth({
    oscillator: {
      type: "square",
    },
    envelope: {
      attack: 0.1,
    },
  }).toDestination();
  //bassSynth.start();
  //synth.triggerAttackRelease("C4", "8n");

  //closedHiHat.start();

  let currentYValue = 0;
  const loadData = async () => {
    const p = new URL(iodaURL);
    console.log(p);

    const response = await fetch(
      `https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw${p.pathname}${p.search}`
    );
    iodaData = await response.json();
    iodaData.data[0].forEach((d) => {
      dataRawValues[d.datasource] = d.values;
      dataSteps[d.datasource] = d.step;
      dataMaxValue[d.datasource] = Math.max(...d.values);
      dataMinValue[d.datasource] = Math.min(...d.values);
    });

    let noteScaleRange = [];
    for (let i = 5; i >= 3; i--) {
      noteScaleRange.push(`C${i}`);
      noteScaleRange.push(`D${i}`);
      noteScaleRange.push(`E${i}`);
      noteScaleRange.push(`F${i}`);
      noteScaleRange.push(`G${i}`);
      noteScaleRange.push(`A${i}`);
      noteScaleRange.push(`B${i}`);
    }

    //gtr-norm,merit-nt,bgp,ping-slash24
    const timeSec = 0.02;
    const pingDurationScale = d3.scaleLinear(
      [dataMinValue["ping-slash24"], dataMaxValue["ping-slash24"]],
      [0, 2]
    );
    const pingFilterScale = d3.scalePow(
      [dataMinValue["ping-slash24"], dataMaxValue["ping-slash24"]],
      [0, 14000]
    );

    //const bgpValNoteScale = d3.scaleThreshold([0, 1], ["red", "white", "blue"]);
    const bgpYScale = d3.scaleLinear(
      [dataMinValue["bgp"], dataMaxValue["bgp"]],
      [0, 300]
    );
    const bgpEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.01,
      decay: 0.4,
      sustain: 0,
    }).toDestination();
    const bgpNoteScale = d3.scaleQuantize(
      [dataMinValue["bgp"], dataMaxValue["bgp"]],
      noteScaleRange
    );

    const vizScale = d3.scalePow([0, 14000], [0, 1]);

    let pingPart = dataRawValues["ping-slash24"].map((v, idx) => {
      let duration = pingDurationScale(v);
      let filter = pingFilterScale(v);

      return {
        duration,
        filter,
        time: timeSec * idx,
        raw: v,
      };
    });
    let bgpPart = [];
    const sliceSize = 10;
    for (let i = 0; i < dataRawValues["bgp"].length / sliceSize; i++) {
      const datumRange = dataRawValues["bgp"].slice(
        sliceSize * i,
        sliceSize * i + sliceSize
      );
      const v = d3.max(datumRange);
      const maxIdx = d3.maxIndex(datumRange);
      let frequency = bgpNoteScale(v);
      bgpPart.push({
        frequency,
        idx: maxIdx + sliceSize * i,
        time: timeSec * i,
        raw: v,
      });
    }

    let bassSynthPart = new Tone.Part((time, value) => {
      currentYValue = value.raw;
      /*
      bassSynth.set({
        frequency: note,
      });
      */
      console.log(value.frequency);
      bassSynth.triggerAttackRelease(value.frequency, "4n");
      //bgpEnvelope.triggerAttack(time);
    }, bgpPart).start(0);

    /*
    const closedHatPart = new Tone.Part((time, value) => {
      lowPass.set({
        frequency: value.filter,
      });
      closedHiHatEnvelope.triggerAttackRelease(value.duration, time);
    }, pingPart).start(0);
    */

    let points = Array(800);
    let currentIdx = 0;
    sketch = (p5) => {
      p5.setup = () => {
        // create a canvas width and height of the screen
        // document.querySelector('canvas')
        p5.createCanvas(800, 300);
        // no fill
        p5.fill(255);
        p5.strokeWeight(1);
        p5.rectMode(p5.CENTER);
      };

      p5.draw = () => {
        p5.background(255);
        p5.stroke(0);

        //p5.map(x, 0,100, 150,350)
        // console.log(closedHiHatEnvelope.value);
        //const y = p5.height * bassSynth.frequency.value;
        const y = bgpYScale(currentYValue);
        points[currentIdx] = [currentIdx, y];
        points.forEach((p) => {
          p5.stroke("green");
          p5.strokeWeight(3);
          p5.point(p[0], p[1]);
        });
        currentIdx = (currentIdx + 1) % 800;
        //p5.rect(beepX, beepY, beepSize, beepSize);
      };
    };
  };

  let stopped = true;
  const startPlay = () => {
    if (stopped) {
      Tone.Transport.start();
      Tone.Destination.mute = false;
      stopped = false;
    } else {
      Tone.Transport.stop();
      Tone.Destination.mute = true;
      stopped = true;
    }
  };
</script>

<div class="container mx-auto pt-10">
  <h2 class="text-5xl">The Sound of Internet Shutdowns</h2>
  <div class="pt-10">
    <input
      type="text"
      placeholder="enter url of ioda chart"
      class="input input-bordered input-primary w-full max-w-2xl"
      bind:value={iodaURL}
    />
    <button class="btn btn-primary" on:click={loadData}>Load</button>
  </div>
  {#if iodaData}
    <JSONTree value={iodaData} />
    {Object.keys(dataSteps)}
  {:else}
    <p>Loading...</p>
  {/if}
  {#if sketch}
    <P5 {sketch} />
  {/if}
  <button class="btn" on:click={startPlay}>Start/Stop</button>
</div>
