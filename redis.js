import { createCluster, createClient } from "redis";

const cluster = createCluster({
  rootNodes: [
    { url: "redis://redis-7000:7000" },
    { url: "redis://redis-7001:7001" },
    { url: "redis://redis-7002:7002" },
    { url: "redis://redis-7003:7003" },
    { url: "redis://redis-7004:7004" },
    { url: "redis://redis-7005:7005" },
  ]
});

await cluster.connect();

await cluster.set("my favourite color", "sky blue");
const client = createClient({ url: "redis://redis-7000:7000" });
await client.connect();
const slot = await client.sendCommand(['cluster', 'keyslot', 'my favourite color']);
const slotinfo = await client.sendCommand(['cluster', 'slots']);
const clusternodes = await client.sendCommand(['cluster', 'nodes']);
const countKeysinslot = await client.sendCommand(['cluster', 'countkeysinslot', slot.toString()]);
const nodesArray = clusternodes.split("\n");
console.log("Slot for my favourite color: ", slot); 
console.log("1st slot info: ", slotinfo[0]);
console.log("2nd slot info: ", slotinfo[1]);
console.log("3rd slot info: ", slotinfo[2]);
console.log("Cluster nodes: ", clusternodes);
console.log("Cluster node for my favourite color: ", nodesArray[0]);
console.log("Count of keys in slot: ", countKeysinslot);
const favouriteColor = await cluster.get("my favourite color");
await cluster.set("my favourite color", "navy blue");
await cluster.del("my favourite color");
console.log(favouriteColor);

cluster.disconnect();