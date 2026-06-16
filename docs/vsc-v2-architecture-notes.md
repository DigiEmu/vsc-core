# VSC v2 Architecture Notes

**Status:** Design documentation for future development  
**Current Version:** v1.x (Node/JavaScript MVP)  
**Last Updated:** v1.12 Benchmark Mode

---

## Core Architectural Principles

### 1. Primary Unit of Proof: The Individual Event

The **Individual Event** is the primary unit of proof for future AI logs and verifiable state systems.

- Each discrete change (file modification, metadata update, state transition) constitutes one event
- Events are individually hashable and verifiable
- Event ordering is preserved through cryptographic chaining
- This principle holds regardless of whether events are processed individually or in batches

### 2. Micro-Batching: Technical Ingestion Optimization Only

Micro-batching is strictly a **technical ingestion and write optimization**.

- Batching reduces I/O overhead and improves throughput
- Batching does NOT change the fundamental proof structure
- Each event within a batch retains its individual identity and hash
- Batch boundaries are operational, not proof boundaries
- A batch of 100 events can be unpacked into 100 individually verifiable proofs

### 3. Checkpointed State Chains: Storage and Restore Optimization

**Checkpointed State Chains** are the storage and restore optimization layer.

- A base snapshot is stored once (checkpoint 0)
- Subsequent deltas represent ordered state transitions
- Chains enable efficient reconstruction of any historical state
- Each link in the chain is independently verifiable
- Chain integrity is protected by cumulative hashing

---

## Operational Modes

VSC v2 will support three distinct operational modes:

| Mode | Purpose | Use Case |
|------|---------|----------|
| **Proof-only** | Generate and verify cryptographic proofs without full payload storage | Audit trails, integrity verification |
| **Locate** | Identify where specific content exists across the chain | Content discovery, forensic analysis |
| **Recover** | Full state reconstruction from base + deltas | Disaster recovery, state restoration |

---

## Payload Handling for Large Objects

### Hash References and External Object Storage

Large payloads must be stored as **hash references** pointing to external object storage.

- Large files (> threshold, e.g., 1MB) are stored in external object storage (S3, IPFS, etc.)
- The delta chain contains only the hash reference, not the payload
- This prevents chain bloat and maintains fast verification
- External storage can be verified independently using the referenced hash

**Anti-pattern:** Embedding large payloads directly inside delta chains causes:
- Excessive chain size
- Slow verification times
- Memory pressure during processing
- Difficulty in selective restoration

---

## High-Frequency Ingestion Architecture

### Append-Only Write-Ahead Log (WAL)

Future high-frequency ingestion requires an **append-only Write-Ahead Log** before in-memory batching.

```
[Event Source] → [WAL] → [In-Memory Batch] → [Delta Encoding] → [Chain Storage]
                ↓
         (durable, sequential,
          crash-recoverable)
```

**WAL characteristics:**
- Append-only writes for durability
- Sequential I/O for performance
- Crash recovery through replay
- Compaction to delta chains at batch boundaries

---

## Core vs Presentation Separation

### Architectural Boundary

VSC maintains strict separation between **Core** and **Presentation** layers.

**Core Layer:**
- Token generation and validation
- Hash computation and verification
- Delta encoding and decoding
- Chain construction and verification
- Emits **JSON evidence** as canonical output

**Presentation Layer:**
- SVG seal rendering
- HTML dashboard generation
- CLI output formatting
- External integrations
- Consumes JSON evidence, produces human-readable output

### Benefits

- Core logic remains portable and testable
- Multiple presentation formats from same evidence
- Easier integration with external systems
- Clear contract between layers (JSON schema)

---

## Technology Roadmap

### v1.x: Node/JavaScript MVP

- Current implementation
- File/folder-based operations
- Local storage only
- Research prototype / proof-of-concept
- Not production-hardened

### v2: Streaming Core in Go

Future v2 may move the critical streaming core to **Go** while preserving the VSC protocol.

**Rationale for Go:**
- Native concurrency for streaming ingestion
- Better memory control for large payloads
- Single static binary for deployment
- Superior performance for I/O-heavy workloads

**Preservation:**
- JSON token format remains compatible
- Proof structure unchanged
- Node.js tooling may remain for presentation layer

---

## Benchmarked Claims Only

VSC v1.x and v2 will avoid unbenchmarked performance claims.

**Until benchmarks exist, we do NOT guarantee:**
- Constant-time restore operations
- Sub-millisecond ingestion latency
- Specific percentage savings (e.g., "90% reduction")
- Linear scaling beyond measured limits

**What we DO measure and report:**
- Storage-load reduction for specific fixture profiles
- Restore time for specific chain lengths
- Verify time for specific folder sizes
- These measurements are reproducible and profile-specific

---

## Design Decision Summary

| Decision | Rationale |
|----------|-----------|
| Individual events as primary proof unit | Audit granularity, selective verification |
| Micro-batching as optimization only | Proof structure integrity preserved |
| Checkpointed chains for storage/restore | Space efficiency, state reconstruction |
| Three modes (Proof, Locate, Recover) | Flexibility for different use cases |
| Hash references for large payloads | Chain performance, external storage flexibility |
| WAL before in-memory batching | Durability, crash recovery |
| Core/Presentation separation | Portability, testability, integration |
| v1.x in Node, v2 core in Go (potential) | Performance, deployment simplicity |
| Benchmarked claims only | Credibility, reproducibility |

---

## Related Documentation

- [VSC v1.12 Benchmark Mode](vsc-v1-12-benchmark-mode.md)
- [VSC MVP Architecture](vsc-mvp-architecture.md)
- [VSC Visual Token Language](vsc-visual-token-language.md)
