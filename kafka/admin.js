import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "kafka-admin",
  brokers: ["localhost:9092"],
})

