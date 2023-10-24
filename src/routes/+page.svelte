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
*/

  /*
  const lowPass = new Tone.Filter({
    frequency: 12000,
  }).toDestination();
*/

  const closedHiHatEnvelope = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: 0.3,
  }).toDestination();

  const closedHiHat = new Tone.NoiseSynth().toDestination();
  const feedbackDelay = new Tone.PingPongDelay({
    delayTime: "8n",
    feedback: 0.6,
    wet: 0.5,
  }).toDestination();
  closedHiHat.connect(feedbackDelay);

  /*
  const bassFilter = new Tone.Filter({
    frequency: 13000,
  });

  const bassSynth = new Tone.PulseOscillator("A2", 0.5)
    .chain(bassFilter)
    .toDestination();
  bassSynth.start();
  */

  const bassSynth = new Tone.FMSynth({
    modulationIndex: 12.22,
    envelope: {
      attack: 0.01,
      decay: 0.2,
    },
    modulation: {
      type: "square",
    },
    modulationEnvelope: {
      attack: 0.2,
      decay: 0.01,
    },
  }).toDestination();
  /*
  const bassSynth = new Tone.MonoSynth({
    oscillator: {
      type: "square",
    },
    envelope: {
      attack: 0.2,
    },
  }).toDestination();
  */
  //bassSynth.start();
  //synth.triggerAttackRelease("C4", "8n");

  //closedHiHat.start();

  let drawingStopped = false;
  let currentBGPValue = 0;
  let currentPingValue = 0;
  const loadData = async () => {
    await Tone.start();
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
    const timeSec = 0.5;
    const pingDurationScale = d3.scaleLinear(
      [dataMinValue["ping-slash24"], dataMaxValue["ping-slash24"]],
      [0, 2]
    );
    const pingFilterScale = d3.scalePow(
      [dataMinValue["ping-slash24"], dataMaxValue["ping-slash24"]],
      [0, 14000]
    );
    const pingDelayScale = d3.scalePow(
      [dataMinValue["ping-slash24"], dataMaxValue["ping-slash24"]],
      [0, 1]
    );
    const pingYScale = d3.scaleLinear(
      [dataMinValue["ping-slash24"], dataMaxValue["ping-slash24"]],
      [0, 300]
    );

    //const bgpValNoteScale = d3.scaleThreshold([0, 1], ["red", "white", "blue"]);
    const bgpYScale = d3.scaleLinear(
      [dataMinValue["bgp"], dataMaxValue["bgp"]],
      [0, 300]
    );

    const bgpNoteScale = d3.scaleQuantize(
      [dataMinValue["bgp"], dataMaxValue["bgp"]],
      noteScaleRange
    );

    const vizScale = d3.scalePow([0, 14000], [0, 1]);

    const resampleDataset = (d, sliceSize, genFunc) => {
      let resampled = [];
      for (let i = 0; i < d.length / sliceSize; i++) {
        const datumRange = d.slice(sliceSize * i, sliceSize * i + sliceSize);
        const v = d3.max(datumRange);
        const maxIdx = d3.maxIndex(datumRange);
        resampled.push(genFunc(v, maxIdx, sliceSize, i));
      }
      return resampled;
    };
    const pingPart = resampleDataset(
      dataRawValues["ping-slash24"],
      10,
      (v, maxIdx, sliceSize, i) => {
        let duration = pingDurationScale(v);
        let filter = pingFilterScale(v);
        return {
          duration,
          filter,
          idx: maxIdx + sliceSize * i,
          time: timeSec * i,
          raw: v,
        };
      }
    );
    const bgpPart = resampleDataset(
      dataRawValues["bgp"],
      20,
      (v, maxIdx, sliceSize, i) => {
        let frequency = bgpNoteScale(v);
        return {
          frequency,
          idx: maxIdx + sliceSize * i,
          time: timeSec * i,
          raw: v,
        };
      }
    );

    let bassSynthPart = new Tone.Part((time, value) => {
      currentBGPValue = value.raw;
      bassSynth.triggerAttackRelease(value.frequency, "4n");
    }, bgpPart).start(0);

    const closedHatPart = new Tone.Part((time, value) => {
      currentPingValue = value.raw;
      //lowPass.set({frequency: value.filter,});
      feedbackDelay.set({
        feedback: pingDelayScale(value.raw),
        wet: pingDelayScale(value.raw),
      });
      closedHiHat.triggerAttackRelease(value.duration);
    }, pingPart).start(0);

    let currentIdx = 0;
    sketch = (p5) => {
      p5.setup = () => {
        // create a canvas width and height of the screen
        // document.querySelector('canvas')
        p5.createCanvas(800, 300);
        // no fill
        p5.fill(255);
        p5.strokeWeight(1);
        //p5.background(255);
        p5.rectMode(p5.CENTER);
      };

      p5.draw = () => {
        if (drawingStopped === false) {
          //p5.background(255);
          p5.stroke(0);

          //p5.map(x, 0,100, 150,350)
          // console.log(closedHiHatEnvelope.value);
          //const y = p5.height * bassSynth.frequency.value;
          p5.stroke("#33A02C");
          p5.strokeWeight(3);
          p5.point(currentIdx, bgpYScale(currentBGPValue));

          p5.stroke("#ED9B40");
          p5.strokeWeight(3);
          p5.point(currentIdx, pingYScale(currentPingValue));
          currentIdx = (currentIdx + 1) % 800;
          //p5.rect(beepX, beepY, beepSize, beepSize);
        }
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
      Tone.Transport.clear();
      Tone.Destination.mute = true;
      stopped = true;
    }
    Tone.Transport.clear();
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
    <button class="btn" on:click={startPlay}>Start/Stop</button>
  </div>
  {#if iodaData}
    <JSONTree value={iodaData} />
  {/if}
  <div class="mt-10">
    {#if sketch}
      <P5 {sketch} />
    {/if}
  </div>
</div>
