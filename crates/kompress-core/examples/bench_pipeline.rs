use kompress_core::pipeline::Pipeline;
use std::hint::black_box;
use std::time::Instant;

fn main() {
    let sizes = [100usize, 1_000, 10_000, 100_000];

    println!(
        "{:>10} {:>12} {:>12} {:>12} {:>12}",
        "messages", "input tok", "output tok", "time ms", "µs/msg"
    );

    for n in sizes {
        let inputs: Vec<String> = (0..n)
            .map(|i| {
                format!(
                    "Message {i}: This is basically just a representative \
                     context message with some filler words, implementation \
                     details, constraints, errors, and useful information."
                )
            })
            .collect();

        let pipeline = Pipeline::new();

        // Warm-up.
        let _ = black_box(pipeline.run(black_box(inputs.clone())).unwrap());

        let start = Instant::now();
        let result = black_box(
            pipeline.run(black_box(inputs)).unwrap()
        );
        let elapsed = start.elapsed();

        println!(
            "{:>10} {:>12} {:>12} {:>12.3} {:>12.3}",
            n,
            result.input_tokens,
            result.output_tokens,
            elapsed.as_secs_f64() * 1000.0,
            elapsed.as_secs_f64() * 1_000_000.0 / n as f64,
        );
    }
}